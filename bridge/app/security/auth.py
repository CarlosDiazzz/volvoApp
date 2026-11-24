"""Credenciales por dispositivo: token = HMAC-SHA256(secreto, "phone:<dispositivo>").

El secreto vive solo en el servidor (variable de entorno). Emitir un token equivale a
dar de alta un celular; revocarlo es agregar el nombre a REVOKED_DEVICES.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import time
from collections import defaultdict, deque

DEVICE_RE = re.compile(r"^[a-z0-9-]{3,32}$")


def make_token(secret: str, device: str) -> str:
    if not DEVICE_RE.fullmatch(device):
        raise ValueError("nombre de dispositivo inválido (a-z, 0-9, guion; 3 a 32)")
    return hmac.new(secret.encode(), f"phone:{device}".encode(), hashlib.sha256).hexdigest()[:48]


def verify(secret: str, device: str, token: str, revoked: set[str]) -> bool:
    if not DEVICE_RE.fullmatch(device or "") or device in revoked:
        return False
    expected = make_token(secret, device)
    return hmac.compare_digest(expected, token or "")


class FailureGuard:
    """Bloquea una IP tras `limit` autenticaciones fallidas en `window` segundos."""

    def __init__(self, limit: int = 5, window: float = 60.0, clock=time.monotonic):
        self.limit, self.window, self.clock = limit, window, clock
        self._fails: dict[str, deque] = defaultdict(deque)

    def _trim(self, ip: str) -> deque:
        q = self._fails[ip]
        now = self.clock()
        while q and now - q[0] > self.window:
            q.popleft()
        return q

    def blocked(self, ip: str) -> bool:
        return len(self._trim(ip)) >= self.limit

    def fail(self, ip: str) -> None:
        self._trim(ip).append(self.clock())


class TokenBucket:
    def __init__(self, rate: float, burst: int, clock=time.monotonic):
        self.rate, self.burst, self.clock = rate, burst, clock
        self.tokens, self.last = float(burst), clock()

    def allow(self) -> bool:
        now = self.clock()
        self.tokens = min(self.burst, self.tokens + (now - self.last) * self.rate)
        self.last = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
