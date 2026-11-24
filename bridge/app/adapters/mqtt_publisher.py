"""Publicador MQTT (mTLS) hacia el broker. Implementa el puerto `Publisher`."""
from __future__ import annotations

import logging
import ssl

import paho.mqtt.client as mqtt

from ..config import Config

log = logging.getLogger("bridge.mqtt")
MAX_QUEUED = 2000


class MqttPublisher:
    def __init__(self, cfg: Config):
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="phone-bridge", clean_session=False)
        ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH, cafile=cfg.mqtt_ca)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(cfg.mqtt_cert, cfg.mqtt_key)
        self._client.tls_set_context(ctx)
        self._client.max_queued_messages_set(MAX_QUEUED)
        self._client.reconnect_delay_set(1, 10)
        self._client.on_connect = lambda *a: log.info("conectado al broker")
        self._client.on_disconnect = lambda *a: log.warning("desconectado del broker")
        self._host, self._port = cfg.mqtt_host, cfg.mqtt_port

    def start(self) -> None:
        self._client.connect_async(self._host, self._port, keepalive=30)
        self._client.loop_start()

    def stop(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()

    @property
    def connected(self) -> bool:
        return self._client.is_connected()

    def publish(self, topic: str, payload: bytes) -> bool:
        return self._client.publish(topic, payload, qos=1).rc == mqtt.MQTT_ERR_SUCCESS
