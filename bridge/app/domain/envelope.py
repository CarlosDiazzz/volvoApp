"""Sobre de muestra cifrada v1 (contrato en volvoInfra/spec/sample-envelope.md).

El puente SOLO valida la forma: no tiene la clave y por eso no puede leer ni alterar el contenido.
"""
from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

DEVICE_PATTERN = r"^[a-z0-9-]{3,32}$"
BUS_PATTERN = r"^[A-Z0-9-]{3,32}$"
MAX_CT_CHARS = 1024
MAX_MESSAGE_CHARS = 2048
MAX_COUNTER = 2**53 - 1
_B64 = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")


class Envelope(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    v: Literal[1]
    device: Annotated[str, StringConstraints(pattern=DEVICE_PATTERN)]
    bus: Annotated[str, StringConstraints(pattern=BUS_PATTERN)]
    ctr: Annotated[int, Field(strict=True, ge=0, le=MAX_COUNTER)]
    ct: Annotated[str, StringConstraints(min_length=24, max_length=MAX_CT_CHARS, pattern=_B64.pattern)]

    def topic(self, prefix: str) -> str:
        return f"{prefix}/{self.bus}/node/{self.device}/sample"
