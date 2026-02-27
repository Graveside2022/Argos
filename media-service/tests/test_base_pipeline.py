"""Unit tests for BasePipeline — health reporting, auto-restart, error handling.

Uses a mock GStreamer pipeline (TestPipeline) that doesn't require real hardware.
Tests can run without a display server or audio devices.
"""

from __future__ import annotations

import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# Add media-service root to path so `src.` imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Mock gi module before importing pipeline code
gi_mock = MagicMock()
gi_mock.require_version = MagicMock()

gst_mock = MagicMock()
gst_mock.State.PLAYING = "PLAYING"
gst_mock.State.NULL = "NULL"
gst_mock.StateChangeReturn.FAILURE = "FAILURE"
gst_mock.StateChangeReturn.SUCCESS = "SUCCESS"

glib_mock = MagicMock()
glib_mock.SOURCE_REMOVE = False
glib_mock.timeout_add_seconds = MagicMock(return_value=42)
glib_mock.source_remove = MagicMock()

gi_mock.repository.Gst = gst_mock
gi_mock.repository.GLib = glib_mock

sys.modules["gi"] = gi_mock
sys.modules["gi.repository"] = gi_mock.repository

from src.pipelines.base import BasePipeline  # noqa: E402


class TestPipeline(BasePipeline):
    """Concrete test implementation of BasePipeline."""

    def __init__(self, should_fail: bool = False) -> None:
        super().__init__("test-pipeline", max_restart_delay_s=30)
        self.should_fail = should_fail
        self.build_count = 0

    def build(self):
        self.build_count += 1
        if self.should_fail:
            raise RuntimeError("Build failed intentionally")
        pipeline = MagicMock()
        pipeline.set_state.return_value = gst_mock.StateChangeReturn.SUCCESS
        bus = MagicMock()
        pipeline.get_bus.return_value = bus
        return pipeline


class TestHealthReporting:
    """Tests for get_health() method."""

    def test_initial_health_is_stopped(self) -> None:
        pipe = TestPipeline()
        health = pipe.get_health()
        assert health["name"] == "test-pipeline"
        assert health["state"] == "stopped"
        assert health["restart_count"] == 0
        assert health["last_error"] is None

    def test_health_after_start(self) -> None:
        pipe = TestPipeline()
        pipe.start()
        health = pipe.get_health()
        assert health["state"] == "running"
        assert health["uptime_s"] >= 0

    def test_health_tracks_processed_count(self) -> None:
        pipe = TestPipeline()
        pipe.start()
        pipe.increment_processed(100)
        pipe.increment_processed(50)
        health = pipe.get_health()
        assert health["total_processed"] == 150

    def test_health_after_stop(self) -> None:
        pipe = TestPipeline()
        pipe.start()
        pipe.stop()
        health = pipe.get_health()
        assert health["state"] == "stopped"
        assert health["uptime_s"] == 0


class TestAutoRestart:
    """Tests for exponential backoff auto-restart."""

    def test_restart_scheduled_on_build_failure(self) -> None:
        pipe = TestPipeline(should_fail=True)
        pipe.start()
        assert pipe.state == "restarting"
        glib_mock.timeout_add_seconds.assert_called()

    def test_restart_count_increments(self) -> None:
        pipe = TestPipeline()
        pipe.start()
        pipe.restart()
        health = pipe.get_health()
        assert health["restart_count"] == 1

    def test_cancel_restart_on_stop(self) -> None:
        pipe = TestPipeline(should_fail=True)
        pipe.start()
        assert pipe.state == "restarting"
        pipe.stop()
        assert pipe.state == "stopped"
        glib_mock.source_remove.assert_called()


class TestErrorHandling:
    """Tests for GStreamer bus error handling."""

    def test_build_failure_sets_error_state(self) -> None:
        pipe = TestPipeline(should_fail=True)
        pipe.start()
        health = pipe.get_health()
        assert health["last_error"] == "Build failed intentionally"

    def test_successful_start_clears_error(self) -> None:
        pipe = TestPipeline(should_fail=True)
        pipe.start()
        assert pipe.get_health()["last_error"] is not None
        pipe.should_fail = False
        pipe.stop()
        pipe.start()
        assert pipe.state == "running"


class TestCleanShutdown:
    """Tests for clean stop behavior."""

    def test_stop_sets_pipeline_to_null(self) -> None:
        pipe = TestPipeline()
        pipe.start()
        pipe.stop()
        assert pipe._pipeline is None
        assert pipe.state == "stopped"

    def test_double_stop_is_safe(self) -> None:
        pipe = TestPipeline()
        pipe.start()
        pipe.stop()
        pipe.stop()  # Should not raise
        assert pipe.state == "stopped"

    def test_stop_before_start_is_safe(self) -> None:
        pipe = TestPipeline()
        pipe.stop()
        assert pipe.state == "stopped"
