"""Base GStreamer pipeline class with lifecycle management and auto-restart.

Subclasses implement build() to return a Gst.Pipeline. BasePipeline handles
start/stop/restart, GStreamer bus messages, health reporting, and exponential
backoff auto-restart on errors.
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Any

import gi

gi.require_version("Gst", "1.0")
gi.require_version("GLib", "2.0")
from gi.repository import GLib, Gst  # noqa: E402

logger = logging.getLogger("media-service.pipeline")

# Auto-restart backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
RESTART_BASE_S = 1
RESTART_MAX_S = 30


class BasePipeline(ABC):
    """Abstract base for GStreamer pipelines with health and auto-restart."""

    def __init__(self, name: str, max_restart_delay_s: int = RESTART_MAX_S) -> None:
        self.name = name
        self._pipeline: Gst.Pipeline | None = None
        self._state = "stopped"
        self._last_error: str | None = None
        self._restart_count = 0
        self._restart_attempt = 0
        self._restart_source_id: int | None = None
        self._max_restart_delay_s = max_restart_delay_s
        self._start_time: float = 0
        self._total_processed: int = 0

    @abstractmethod
    def build(self) -> Gst.Pipeline:
        """Construct and return a GStreamer pipeline. Called by start()."""

    @property
    def state(self) -> str:
        return self._state

    def start(self) -> bool:
        """Build and start the pipeline. Returns True on success."""
        if self._pipeline is not None:
            self.stop()

        try:
            self._pipeline = self.build()
        except Exception as exc:
            logger.error("[%s] Pipeline build failed: %s", self.name, exc)
            self._state = "error"
            self._last_error = str(exc)
            self._schedule_restart()
            return False

        bus = self._pipeline.get_bus()
        bus.add_signal_watch()
        bus.connect("message::error", self._on_bus_error)
        bus.connect("message::warning", self._on_bus_warning)
        bus.connect("message::eos", self._on_bus_eos)
        bus.connect("message::state-changed", self._on_state_changed)

        ret = self._pipeline.set_state(Gst.State.PLAYING)
        if ret == Gst.StateChangeReturn.FAILURE:
            logger.error("[%s] Failed to set pipeline to PLAYING", self.name)
            self._state = "error"
            self._last_error = "Failed to start pipeline"
            self._cleanup_pipeline()
            self._schedule_restart()
            return False

        self._state = "running"
        self._start_time = time.monotonic()
        self._restart_attempt = 0  # Reset backoff on successful start
        logger.info("[%s] Pipeline started", self.name)
        return True

    def stop(self) -> None:
        """Stop the pipeline and release resources."""
        self._cancel_restart()
        if self._pipeline is not None:
            self._pipeline.set_state(Gst.State.NULL)
            self._cleanup_pipeline()
        self._state = "stopped"
        logger.info("[%s] Pipeline stopped", self.name)

    def restart(self) -> bool:
        """Stop and re-start the pipeline."""
        logger.info("[%s] Restarting pipeline", self.name)
        self._restart_count += 1
        self.stop()
        return self.start()

    def get_health(self) -> dict[str, Any]:
        """Return a PipelineState dict for the health monitor."""
        uptime = time.monotonic() - self._start_time if self._state == "running" else 0
        return {
            "name": self.name,
            "state": self._state,
            "latency_ms": self._get_latency_ms(),
            "buffer_pct": self._get_buffer_pct(),
            "throughput": self._get_throughput(),
            "total_processed": self._total_processed,
            "uptime_s": round(uptime, 1),
            "last_error": self._last_error,
            "restart_count": self._restart_count,
        }

    def increment_processed(self, count: int = 1) -> None:
        """Called by subclasses to track total processed samples/frames."""
        self._total_processed += count

    # ── Overridable metric hooks ──────────────────────────

    def _get_latency_ms(self) -> float:
        """Override in subclasses to report pipeline latency."""
        return 0.0

    def _get_buffer_pct(self) -> float:
        """Override in subclasses to report queue fill percentage."""
        return 0.0

    def _get_throughput(self) -> float:
        """Override in subclasses to report samples/sec or FPS."""
        return 0.0

    # ── GStreamer bus handlers ────────────────────────────

    def _on_bus_error(
        self, bus: Gst.Bus, msg: Gst.Message
    ) -> None:
        err, debug = msg.parse_error()
        self._last_error = str(err)
        logger.error("[%s] GStreamer error: %s (debug: %s)", self.name, err, debug)
        self._state = "error"
        self._cleanup_pipeline()
        self._schedule_restart()

    def _on_bus_warning(
        self, bus: Gst.Bus, msg: Gst.Message
    ) -> None:
        warn, debug = msg.parse_warning()
        logger.warning("[%s] GStreamer warning: %s (debug: %s)", self.name, warn, debug)

    def _on_bus_eos(self, bus: Gst.Bus, msg: Gst.Message) -> None:
        logger.info("[%s] End of stream", self.name)
        self._state = "stopped"
        self._cleanup_pipeline()

    def _on_state_changed(
        self, bus: Gst.Bus, msg: Gst.Message
    ) -> None:
        if msg.src != self._pipeline:
            return
        old, new, pending = msg.parse_state_changed()
        logger.debug(
            "[%s] State: %s -> %s (pending: %s)",
            self.name,
            old.value_nick,
            new.value_nick,
            pending.value_nick,
        )

    # ── Auto-restart with exponential backoff ─────────────

    def _schedule_restart(self) -> None:
        """Schedule a restart with exponential backoff via GLib."""
        if self._restart_source_id is not None:
            return  # Already scheduled

        delay_s = min(
            RESTART_BASE_S * (2 ** self._restart_attempt),
            self._max_restart_delay_s,
        )
        self._restart_attempt += 1
        self._state = "restarting"
        logger.info(
            "[%s] Auto-restart in %.0fs (attempt %d)",
            self.name,
            delay_s,
            self._restart_attempt,
        )
        self._restart_source_id = GLib.timeout_add_seconds(
            int(delay_s), self._do_restart
        )

    def _do_restart(self) -> bool:
        """GLib timeout callback — performs the restart."""
        self._restart_source_id = None
        self._restart_count += 1
        if not self.start():
            # start() already calls _schedule_restart on failure
            pass
        return GLib.SOURCE_REMOVE

    def _cancel_restart(self) -> None:
        """Cancel any pending auto-restart timer."""
        if self._restart_source_id is not None:
            GLib.source_remove(self._restart_source_id)
            self._restart_source_id = None

    def _cleanup_pipeline(self) -> None:
        """Release the GStreamer pipeline object."""
        if self._pipeline is not None:
            bus = self._pipeline.get_bus()
            if bus:
                bus.remove_signal_watch()
            self._pipeline.set_state(Gst.State.NULL)
            self._pipeline = None
