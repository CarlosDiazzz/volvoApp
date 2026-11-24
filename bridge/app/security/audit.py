"""Bitácora de eventos con hash encadenado: cada línea incluye el hash de la anterior,
por lo que borrar o editar una línea intermedia se detecta con `verify_chain`.
Nunca se registran tokens, secretos ni cargas de sensores."""
from __future__ import annotations

import hashlib
import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("bridge.audit")
GENESIS = "0" * 64


def _digest(prev: str, body: str) -> str:
    return hashlib.sha256((prev + body).encode()).hexdigest()


class AuditLog:
    def __init__(self, path: str | None):
        self.path = Path(path) if path else None
        self._lock = threading.Lock()
        self._prev = GENESIS
        if self.path:
            try:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                if self.path.exists():
                    last = ""
                    with self.path.open() as fh:
                        for last in fh:
                            pass
                    if last.strip():
                        self._prev = json.loads(last)["hash"]
            except OSError as exc:  # sin disco: se sigue registrando en stdout
                log.error("no se pudo abrir la bitácora %s: %s", self.path, exc)
                self.path = None

    def write(self, event: str, **fields) -> dict:
        with self._lock:
            body = json.dumps({"ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
                               "event": event, **fields}, sort_keys=True, separators=(",", ":"))
            h = _digest(self._prev, body)
            line = json.dumps({"body": body, "prev": self._prev, "hash": h}, separators=(",", ":"))
            self._prev = h
            log.info("audit %s", body)
            if self.path:
                try:
                    with self.path.open("a") as fh:
                        fh.write(line + "\n")
                except OSError as exc:
                    log.error("fallo al escribir la bitácora: %s", exc)
            return json.loads(line)


def verify_chain(path: str) -> bool:
    prev = GENESIS
    with open(path) as fh:
        for raw in fh:
            rec = json.loads(raw)
            if rec["prev"] != prev or rec["hash"] != _digest(prev, rec["body"]):
                return False
            prev = rec["hash"]
    return True
