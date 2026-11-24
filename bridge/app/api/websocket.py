"""Endpoint WebSocket de los celulares: autentica, aplica límites y delega en el caso de uso."""
from __future__ import annotations

import asyncio
import collections

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..application.relay import Outcome, RelayService
from ..config import Config
from ..security.audit import AuditLog
from ..security.auth import FailureGuard, TokenBucket, verify

HELLO_TIMEOUT_S = 5
MAX_REJECTED = 50
CLOSE_DENIED, CLOSE_BLOCKED, CLOSE_FLOOD = 4401, 4429, 4400


class _Hello(BaseModel):
    model_config = ConfigDict(extra="forbid")

    class Auth(BaseModel):
        model_config = ConfigDict(extra="forbid")
        device: str = Field(max_length=32)
        token: str = Field(max_length=128)

    hello: Auth


class DeviceEndpoint:
    def __init__(self, cfg: Config, relay: RelayService, audit: AuditLog):
        self._cfg, self._relay, self._audit = cfg, relay, audit
        self._guard = FailureGuard()

    async def handle(self, ws: WebSocket) -> None:
        ip = ws.client.host if ws.client else "?"
        if self._guard.blocked(ip):
            self._audit.write("auth_blocked", ip=ip)
            return await ws.close(code=CLOSE_BLOCKED)
        await ws.accept()
        device = await self._authenticate(ws, ip)
        if device is None:
            return
        await ws.send_text('{"ok":true}')
        await self._receive_loop(ws, ip, device)

    async def _authenticate(self, ws: WebSocket, ip: str) -> str | None:
        try:
            hello = _Hello.model_validate_json(await asyncio.wait_for(ws.receive_text(), HELLO_TIMEOUT_S)).hello
            if not verify(self._cfg.secret, hello.device, hello.token, self._cfg.revoked):
                raise ValueError("token")
        except (ValidationError, asyncio.TimeoutError, WebSocketDisconnect, ValueError) as exc:
            self._guard.fail(ip)
            self._audit.write("auth_fail", ip=ip, reason=type(exc).__name__)
            await ws.close(code=CLOSE_DENIED)
            return None
        self._audit.write("device_connected", ip=ip, device=hello.device)
        return hello.device

    async def _receive_loop(self, ws: WebSocket, ip: str, device: str) -> None:
        bucket = TokenBucket(rate=6, burst=12)
        rejected: collections.Counter[str] = collections.Counter()
        forwarded = 0
        try:
            while True:
                raw = await ws.receive_text()
                outcome = self._relay.relay(device, raw) if bucket.allow() else Outcome.BAD_SCHEMA
                if outcome is Outcome.FORWARDED:
                    forwarded += 1
                    continue
                rejected[outcome.value] += 1
                if sum(rejected.values()) >= MAX_REJECTED:
                    self._audit.write("device_cut", ip=ip, device=device, reason="too_many_rejections")
                    return await ws.close(code=CLOSE_FLOOD)
        except WebSocketDisconnect:
            pass
        finally:
            self._audit.write("device_disconnected", device=device, forwarded=forwarded, rejected=dict(rejected))
