"""Media-service entry point — initializes GStreamer, MQTT, pipelines, and health.

Loads configuration from YAML, connects to Mosquitto, registers pipeline
command handlers, starts the health monitor, and runs the GLib main loop.
Handles SIGTERM for clean shutdown.
"""

from __future__ import annotations

import logging
import os
import signal
import sys
from typing import Any

import gi
import yaml

gi.require_version("Gst", "1.0")
gi.require_version("GLib", "2.0")
from gi.repository import GLib, Gst  # noqa: E402

from src.health.monitor import HealthMonitor
from src.mqtt_client import MqttClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("media-service")

PIPELINE_COMMAND_TOPIC = "argos/media/pipeline/command"
VALID_ACTIONS = {"start", "stop", "restart"}
VALID_PIPELINES = {
    "radio-audio",
    "audio-cleanup",
    "video-detection",
    "recording",
    "rtsp-server",
}


def load_config(config_path: str) -> dict[str, Any]:
    """Load and return YAML configuration, with env var overrides."""
    with open(config_path) as f:
        config = yaml.safe_load(f) or {}

    # Environment variable overrides
    mqtt = config.setdefault("mqtt", {})
    mqtt["broker"] = os.environ.get("MEDIA_SERVICE_MQTT_BROKER", mqtt.get("broker", "mosquitto"))
    mqtt["port"] = int(os.environ.get("MEDIA_SERVICE_MQTT_PORT", mqtt.get("port", 1883)))

    return config


def create_pipeline_command_handler(
    health: HealthMonitor,
) -> Any:
    """Return an MQTT callback that handles pipeline start/stop/restart commands."""

    def handler(topic: str, payload: dict[str, Any]) -> None:
        pipeline_name = payload.get("pipeline", "")
        action = payload.get("action", "")

        if pipeline_name not in VALID_PIPELINES:
            logger.warning("Unknown pipeline in command: %s", pipeline_name)
            return
        if action not in VALID_ACTIONS:
            logger.warning("Unknown action in command: %s", action)
            return

        pipeline = health._pipelines.get(pipeline_name)
        if pipeline is None:
            logger.warning("Pipeline %s not registered", pipeline_name)
            return

        logger.info("Command: %s %s", action, pipeline_name)
        if action == "start":
            pipeline.start()
        elif action == "stop":
            pipeline.stop()
        elif action == "restart":
            pipeline.restart()

    return handler


def main() -> None:
    """Initialize and run the media service."""
    # Initialize GStreamer
    Gst.init(None)
    logger.info("GStreamer %s initialized", Gst.version_string())

    # Load configuration
    config_path = os.environ.get(
        "MEDIA_SERVICE_CONFIG",
        "/app/config/media-service.yaml",
    )
    config = load_config(config_path)
    logger.info("Configuration loaded from %s", config_path)

    # Create MQTT client
    mqtt_cfg = config.get("mqtt", {})
    mqtt = MqttClient(
        broker=mqtt_cfg.get("broker", "mosquitto"),
        port=mqtt_cfg.get("port", 1883),
    )
    mqtt.connect()

    # Create health monitor
    health_cfg = config.get("health", {})
    recording_cfg = config.get("recording", {})
    health = HealthMonitor(
        mqtt=mqtt,
        interval_s=health_cfg.get("interval_s", 5),
        recording_dir=recording_cfg.get("directory", "/data/recordings"),
        disk_warning_threshold_mb=recording_cfg.get("disk_warning_threshold_mb", 500),
    )

    # Register pipeline command handler
    mqtt.subscribe(
        PIPELINE_COMMAND_TOPIC,
        create_pipeline_command_handler(health),
    )

    # Start health monitor (pipelines will be registered by later phases)
    health.start()

    # GLib main loop
    loop = GLib.MainLoop()

    def shutdown(signum: int, frame: Any) -> None:
        logger.info("Received signal %d, shutting down...", signum)
        health.stop()
        mqtt.disconnect()
        loop.quit()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    logger.info("Media service running — waiting for pipeline registrations")

    try:
        loop.run()
    except KeyboardInterrupt:
        pass
    finally:
        health.stop()
        mqtt.disconnect()
        Gst.deinit()
        logger.info("Media service stopped")


if __name__ == "__main__":
    main()
