"""Configuración del puente por variables de entorno (nada de secretos en el código)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    secret: str                                  # autentica conexiones; NO descifra muestras
    port: int = 8443
    ca_port: int = 8081
    tls_cert: str | None = None
    tls_key: str | None = None
    ca_file: str | None = None
    audit_path: str = "/data/audit.log"
    topic_prefix: str = "fleet"
    mqtt_host: str = "broker"
    mqtt_port: int = 8883
    mqtt_ca: str = "/certs/ca.crt"
    mqtt_cert: str = "/certs/phone-bridge.crt"
    mqtt_key: str = "/certs/phone-bridge.key"
    revoked: set[str] = field(default_factory=set)

    @staticmethod
    def from_env() -> "Config":
        env = os.environ
        secret = env.get("BRIDGE_SECRET", "")
        if len(secret) < 32:
            raise SystemExit("BRIDGE_SECRET es obligatorio y debe tener al menos 32 caracteres (make init).")
        return Config(
            secret=secret,
            port=int(env.get("BRIDGE_PORT", "8443")),
            ca_port=int(env.get("CA_PORT", "8081")),
            tls_cert=env.get("TLS_CERT") or None,
            tls_key=env.get("TLS_KEY") or None,
            ca_file=env.get("CA_FILE") or None,
            audit_path=env.get("AUDIT_PATH", "/data/audit.log"),
            topic_prefix=env.get("TOPIC_PREFIX", "fleet"),
            mqtt_host=env.get("MQTT_HOST", "broker"),
            mqtt_port=int(env.get("MQTT_PORT", "8883")),
            mqtt_ca=env.get("MQTT_CA", "/certs/ca.crt"),
            mqtt_cert=env.get("MQTT_CERT", "/certs/phone-bridge.crt"),
            mqtt_key=env.get("MQTT_KEY", "/certs/phone-bridge.key"),
            revoked={d.strip() for d in env.get("REVOKED_DEVICES", "").split(",") if d.strip()},
        )
