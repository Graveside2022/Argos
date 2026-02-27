"""Health monitor — collects pipeline states + system metrics, publishes to MQTT.

Publishes a HealthReport JSON to argos/media/health every health_interval_s
seconds with retain=true, so new subscribers immediately get the last state.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import gi
import psutil

gi.require_version("GLib", "2.0")
from gi.repository import GLib  # noqa: E402

from src.mqtt_client import MqttClient
from src.pipelines.base import BasePipeline

logger = logging.getLogger("media-service.health")

HEALTH_TOPIC = "argos/media/health"
ERROR_TOPIC = "argos/media/errors"


class HealthMonitor:
    """Periodically collects pipeline health and system metrics."""

    def __init__(
        self,
        mqtt: MqttClient,
        interval_s: int = 5,
        recording_dir: str = "/data/recordings",
        disk_warning_threshold_mb: int = 500,
    ) -> None:
        self._mqtt = mqtt
        self._interval_s = interval_s
        self._recording_dir = recording_dir
        self._disk_warning_mb = disk_warning_threshold_mb
        self._pipelines: dict[str, BasePipeline] = {}
        self._timer_id: int | None = None

    def register(self, pipeline: BasePipeline) -> None:
        """Register a pipeline for health monitoring."""
        self._pipelines[pipeline.name] = pipeline

    def unregister(self, name: str) -> None:
        """Remove a pipeline from monitoring."""
        self._pipelines.pop(name, None)

    def start(self) -> None:
        """Start the periodic health publishing timer."""
        if self._timer_id is not None:
            return
        self._timer_id = GLib.timeout_add_seconds(
            self._interval_s, self._publish_health
        )
        logger.info("Health monitor started (interval=%ds)", self._interval_s)
        # Publish initial state immediately
        self._publish_health()

    def stop(self) -> None:
        """Stop the periodic health publishing timer."""
        if self._timer_id is not None:
            GLib.source_remove(self._timer_id)
            self._timer_id = None
        logger.info("Health monitor stopped")

    def publish_error(
        self,
        pipeline_name: str,
        error: str,
        debug: str = "",
        severity: str = "error",
    ) -> None:
        """Publish a pipeline error event to MQTT."""
        self._mqtt.publish(
            ERROR_TOPIC,
            {
                "pipeline": pipeline_name,
                "error": error,
                "debug": debug,
                "severity": severity,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            qos=1,
        )

    def _publish_health(self) -> bool:
        """Collect and publish health report. Returns True to keep GLib timer."""
        report = self._build_report()
        self._mqtt.publish(HEALTH_TOPIC, report, qos=0, retain=True)
        return True  # GLib.SOURCE_CONTINUE

    def _build_report(self) -> dict[str, Any]:
        """Build a complete HealthReport dict."""
        pipeline_states: dict[str, Any] = {}
        for name, pipeline in self._pipelines.items():
            pipeline_states[name] = pipeline.get_health()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pipelines": pipeline_states,
            "system": self._collect_system_metrics(),
        }

    def _collect_system_metrics(self) -> dict[str, Any]:
        """Collect container-level CPU, memory, and disk metrics via psutil."""
        cpu_pct = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        try:
            disk = psutil.disk_usage(self._recording_dir)
            disk_free_mb = round(disk.free / (1024 * 1024), 1)
        except OSError:
            disk_free_mb = 0.0

        return {
            "cpu_pct": cpu_pct,
            "mem_mb": round(mem.used / (1024 * 1024), 1),
            "disk_free_mb": disk_free_mb,
            "disk_warning": disk_free_mb < self._disk_warning_mb,
        }
