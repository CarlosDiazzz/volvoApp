"""Puente de sensores móviles (relevo no confiable): recibe muestras CIFRADAS por WSS y las reenvía al broker.

celular --WSS (token de dispositivo)--> puente --MQTT mTLS--> broker --> backend (descifra y verifica)
El puente no tiene la clave de los dispositivos: no puede leer, alterar ni falsificar muestras.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.responses import JSONResponse

from .adapters.ca_server import serve_ca_certificate
from .adapters.mqtt_publisher import MqttPublisher
from .api.websocket import DeviceEndpoint
from .application.relay import Publisher, RelayService
from .config import Config
from .security.audit import AuditLog

SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000",
    "Cache-Control": "no-store",
}


def create_app(cfg: Config, publisher: Publisher, audit: AuditLog | None = None) -> FastAPI:
    audit = audit or AuditLog(cfg.audit_path)
    endpoint = DeviceEndpoint(cfg, RelayService(publisher, cfg.topic_prefix), audit)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if hasattr(publisher, "start"):
            publisher.start()
        if cfg.ca_file and Path(cfg.ca_file).exists():
            serve_ca_certificate(cfg.ca_file, cfg.ca_port)
        audit.write("bridge_start")
        yield
        if hasattr(publisher, "stop"):
            publisher.stop()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        return response

    @app.get("/healthz")
    async def healthz():
        return JSONResponse({"status": "UP", "broker": getattr(publisher, "connected", True)})

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket):
        await endpoint.handle(ws)

    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    cfg = Config.from_env()
    tls = {"ssl_certfile": cfg.tls_cert, "ssl_keyfile": cfg.tls_key} if cfg.tls_cert and cfg.tls_key else {}
    if not tls:
        logging.getLogger("bridge").warning("SIN TLS: use solo en pruebas locales")
    uvicorn.run(create_app(cfg, MqttPublisher(cfg)), host="0.0.0.0", port=cfg.port, log_level="warning", **tls)


if __name__ == "__main__":
    main()
