"""Caso de uso: retransmitir muestras cifradas sin poder leerlas.

Aplica solo filtros baratos (forma, dispositivo autenticado, contador creciente). La verificación
criptográfica y el anti-repetición definitivo ocurren en el backend.
"""
from __future__ import annotations

import enum
from typing import Protocol

from pydantic import ValidationError

from ..domain.envelope import MAX_MESSAGE_CHARS, Envelope


class Publisher(Protocol):
    def publish(self, topic: str, payload: bytes) -> bool: ...


class Outcome(str, enum.Enum):
    FORWARDED = "forwarded"
    BAD_SCHEMA = "bad_schema"
    DEVICE_MISMATCH = "device_mismatch"
    REPLAY = "replay"
    UNAVAILABLE = "unavailable"


class RelayService:
    def __init__(self, publisher: Publisher, topic_prefix: str = "fleet"):
        self._publisher = publisher
        self._prefix = topic_prefix
        self._last_ctr: dict[str, int] = {}

    def relay(self, authenticated_device: str, raw: str) -> Outcome:
        if len(raw) > MAX_MESSAGE_CHARS:
            return Outcome.BAD_SCHEMA
        try:
            envelope = Envelope.model_validate_json(raw)
        except ValidationError:
            return Outcome.BAD_SCHEMA
        if envelope.device != authenticated_device:
            return Outcome.DEVICE_MISMATCH
        if envelope.ctr <= self._last_ctr.get(envelope.device, -1):
            return Outcome.REPLAY
        if not self._publisher.publish(envelope.topic(self._prefix), envelope.model_dump_json().encode()):
            return Outcome.UNAVAILABLE
        self._last_ctr[envelope.device] = envelope.ctr
        return Outcome.FORWARDED
