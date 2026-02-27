"""MQTT client wrapper with auto-reconnect and JSON serialization.

Mirrors the exponential backoff pattern from src/lib/server/tak/tak-service.ts.
"""

from __future__ import annotations

import json
import logging
import random
import time
from typing import Any, Callable

import paho.mqtt.client as mqtt

logger = logging.getLogger("media-service.mqtt")

RECONNECT_BASE_S = 1.0
RECONNECT_MAX_S = 30.0


class MqttClient:
    """MQTT pub/sub wrapper with auto-reconnect (exponential backoff 1s-30s)."""

    def __init__(self, broker: str, port: int = 1883) -> None:
        self._broker = broker
        self._port = port
        self._reconnect_attempt = 0
        self._subscriptions: dict[str, list[Callable[[str, dict[str, Any]], None]]] = {}
        self._connected = False

        self._client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"argos-media-{int(time.time())}",
            protocol=mqtt.MQTTv311,
        )
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

    @property
    def connected(self) -> bool:
        return self._connected

    def connect(self) -> None:
        """Start connection with auto-reconnect loop managed by paho."""
        logger.info("Connecting to MQTT broker %s:%d", self._broker, self._port)
        self._client.connect_async(self._broker, self._port, keepalive=60)
        self._client.loop_start()

    def disconnect(self) -> None:
        """Clean disconnect — stops the network loop."""
        self._client.loop_stop()
        self._client.disconnect()
        self._connected = False

    def publish(
        self,
        topic: str,
        payload: dict[str, Any],
        qos: int = 0,
        retain: bool = False,
    ) -> None:
        """Publish a JSON-serialized payload to an MQTT topic."""
        if not self._connected:
            logger.warning("Publish to %s while disconnected — message dropped", topic)
            return
        data = json.dumps(payload, default=str)
        self._client.publish(topic, data, qos=qos, retain=retain)

    def subscribe(
        self,
        topic: str,
        callback: Callable[[str, dict[str, Any]], None],
    ) -> None:
        """Subscribe to a topic with a JSON-parsed callback.

        Subscriptions are re-registered on reconnect.
        """
        if topic not in self._subscriptions:
            self._subscriptions[topic] = []
        self._subscriptions[topic].append(callback)
        if self._connected:
            self._client.subscribe(topic, qos=1)

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any,
        rc: int | mqtt.ReasonCode,
        properties: Any = None,
    ) -> None:
        reason = rc if isinstance(rc, int) else rc.value
        if reason == 0:
            self._connected = True
            self._reconnect_attempt = 0
            logger.info("Connected to MQTT broker %s:%d", self._broker, self._port)
            # Re-subscribe to all registered topics
            for topic in self._subscriptions:
                client.subscribe(topic, qos=1)
        else:
            logger.error("MQTT connection failed: rc=%s", rc)

    def _on_disconnect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any = None,
        rc: int | mqtt.ReasonCode = 0,
        properties: Any = None,
    ) -> None:
        self._connected = False
        reason = rc if isinstance(rc, int) else rc.value
        if reason != 0:
            delay = self._backoff_delay()
            logger.warning(
                "MQTT disconnected (rc=%s), reconnecting in %.1fs (attempt %d)",
                rc,
                delay,
                self._reconnect_attempt,
            )
            self._reconnect_attempt += 1
            # paho handles reconnect automatically via reconnect_delay_set
            self._client.reconnect_delay_set(
                min_delay=int(delay),
                max_delay=int(RECONNECT_MAX_S),
            )

    def _on_message(
        self,
        client: mqtt.Client,
        userdata: Any,
        msg: mqtt.MQTTMessage,
    ) -> None:
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.warning("Malformed MQTT payload on %s: %s", msg.topic, exc)
            return

        for topic_pattern, callbacks in self._subscriptions.items():
            if mqtt.topic_matches_sub(topic_pattern, msg.topic):
                for cb in callbacks:
                    try:
                        cb(msg.topic, payload)
                    except Exception:
                        logger.exception("Error in MQTT callback for %s", msg.topic)

    def _backoff_delay(self) -> float:
        """Exponential backoff with jitter: base * 2^attempt + random, capped."""
        exp_delay = RECONNECT_BASE_S * (2 ** self._reconnect_attempt)
        jitter = random.uniform(0, RECONNECT_BASE_S)
        return min(exp_delay + jitter, RECONNECT_MAX_S)
