import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.application.relay import Outcome, RelayService
from app.config import Config
from app.main import create_app
from app.security.audit import AuditLog, verify_chain
from app.security.auth import FailureGuard, TokenBucket, make_token, verify

SECRET = "s" * 40
VECTORS = json.loads((Path(__file__).parent / "spec" / "test-vectors.json").read_text())["vectors"]
ENV = VECTORS[1]["envelope"]  # device phone-1, bus BUS-7700, ctr 42


class FakePublisher:
    connected = True

    def __init__(self, ok=True):
        self.ok, self.sent = ok, []

    def publish(self, topic, payload):
        if self.ok:
            self.sent.append((topic, json.loads(payload)))
        return self.ok


def make_client(tmp_path, publisher=None):
    pub = publisher or FakePublisher()
    cfg = Config(secret=SECRET, audit_path=str(tmp_path / "audit.log"))
    return TestClient(create_app(cfg, pub)), pub, cfg


def hello(device="phone-1", secret=SECRET):
    return json.dumps({"hello": {"device": device, "token": make_token(secret, device)}})


def envelope(**over):
    return json.dumps({**ENV, **over})


# --- autenticación ---------------------------------------------------------------
def test_token_por_dispositivo_y_revocacion():
    t = make_token(SECRET, "phone-1")
    assert verify(SECRET, "phone-1", t, set())
    assert not verify(SECRET, "phone-2", t, set())
    assert not verify(SECRET, "phone-1", t, {"phone-1"})
    with pytest.raises(ValueError):
        make_token(SECRET, "Mal Nombre")


def test_token_coincide_con_el_vector_de_referencia():
    data = json.loads((Path(__file__).parent / "spec" / "test-vectors.json").read_text())
    for v in data["vectors"]:
        assert make_token(data["auth_secret"], v["device"]) == v["auth_token"]


def test_guard_y_bucket():
    t = [0.0]
    g = FailureGuard(limit=3, window=10, clock=lambda: t[0])
    for _ in range(3):
        g.fail("1.1.1.1")
    assert g.blocked("1.1.1.1") and not g.blocked("2.2.2.2")
    t[0] = 11
    assert not g.blocked("1.1.1.1")
    b = TokenBucket(rate=1, burst=2, clock=lambda: t[0])
    assert b.allow() and b.allow() and not b.allow()


# --- caso de uso: relevo ----------------------------------------------------------------
def test_relevo_reenvia_el_sobre_intacto_y_sin_texto_plano():
    pub = FakePublisher()
    out = RelayService(pub).relay("phone-1", json.dumps(ENV))
    assert out is Outcome.FORWARDED
    topic, payload = pub.sent[0]
    assert topic == "fleet/BUS-7700/node/phone-1/sample"
    assert payload == ENV  # el puente no modifica nada


def test_relevo_rechazos():
    svc = RelayService(FakePublisher())
    assert svc.relay("phone-1", envelope(device="otro-dev")) is Outcome.DEVICE_MISMATCH
    assert svc.relay("phone-1", envelope(v=2)) is Outcome.BAD_SCHEMA
    assert svc.relay("phone-1", envelope(ctr=-1)) is Outcome.BAD_SCHEMA
    assert svc.relay("phone-1", envelope(ct="no es base64!")) is Outcome.BAD_SCHEMA
    assert svc.relay("phone-1", envelope(extra="x")) is Outcome.BAD_SCHEMA
    assert svc.relay("phone-1", "no json") is Outcome.BAD_SCHEMA
    assert svc.relay("phone-1", "x" * 5000) is Outcome.BAD_SCHEMA
    assert svc.relay("phone-1", envelope(bus="bus mal")) is Outcome.BAD_SCHEMA


def test_relevo_prefiltra_repeticiones_y_reporta_broker_caido():
    svc = RelayService(FakePublisher())
    assert svc.relay("phone-1", envelope(ctr=5)) is Outcome.FORWARDED
    assert svc.relay("phone-1", envelope(ctr=5)) is Outcome.REPLAY
    assert svc.relay("phone-1", envelope(ctr=4)) is Outcome.REPLAY
    assert svc.relay("phone-1", envelope(ctr=6)) is Outcome.FORWARDED
    down = RelayService(FakePublisher(ok=False))
    assert down.relay("phone-1", envelope(ctr=9)) is Outcome.UNAVAILABLE
    assert down.relay("phone-1", envelope(ctr=9)) is Outcome.UNAVAILABLE  # no consume el contador si no se publicó


# --- WebSocket ------------------------------------------------------------------------------
def test_ws_flujo_completo(tmp_path):
    c, pub, _ = make_client(tmp_path)
    with c.websocket_connect("/ws") as ws:
        ws.send_text(hello())
        assert ws.receive_json() == {"ok": True}
        ws.send_text(json.dumps(ENV))
        assert ws.receive_json() == {"ack": 42}              # confirmada: la app puede borrarla de su cola
        ws.send_text(json.dumps(ENV))                       # repetida: no se reenvía, pero se confirma (reenvío legítimo tras reconectar)
        assert ws.receive_json() == {"ack": 42}
        ws.send_text(envelope(device="phone-2", ctr=50))    # de otro dispositivo: se descarta sin confirmar
    assert [p[1]["ctr"] for p in pub.sent] == [42]


def test_ws_confirmaciones_para_la_cola_del_celular(tmp_path):
    c, pub, _ = make_client(tmp_path)
    with c.websocket_connect("/ws") as ws:
        ws.send_text(hello())
        ws.receive_json()
        for ctr in (1, 2, 3):
            ws.send_text(envelope(ctr=ctr))
            assert ws.receive_json() == {"ack": ctr}
        ws.send_text(envelope(ctr=2))                       # reenvío de lo ya entregado
        assert ws.receive_json() == {"ack": 2}
    assert [p[1]["ctr"] for p in pub.sent] == [1, 2, 3]


def test_ws_broker_caido_responde_nack_y_no_corta_al_celular(tmp_path):
    c, pub, _ = make_client(tmp_path)
    pub.ok = False
    with c.websocket_connect("/ws") as ws:
        ws.send_text(hello())
        ws.receive_json()
        for ctr in range(1, 11):                            # el broker caído no es culpa del celular (dentro de la ráfaga permitida)
            ws.send_text(envelope(ctr=ctr))
            assert ws.receive_json() == {"nack": ctr, "reason": "unavailable"}
        pub.ok = True
        ws.send_text(envelope(ctr=1))
        assert ws.receive_json() == {"ack": 1}              # la misma muestra se acepta cuando vuelve el broker
    assert [p[1]["ctr"] for p in pub.sent] == [1]


def test_relay_ex_devuelve_el_contador_solo_si_el_sobre_es_valido():
    svc = RelayService(FakePublisher())
    assert svc.relay_ex("phone-1", envelope(ctr=7)) == (Outcome.FORWARDED, 7)
    assert svc.relay_ex("phone-1", envelope(ctr=7)) == (Outcome.REPLAY, 7)
    assert svc.relay_ex("phone-1", "basura") == (Outcome.BAD_SCHEMA, None)
    assert svc.relay_ex("phone-1", envelope(device="phone-2", ctr=1)) == (Outcome.DEVICE_MISMATCH, None)


def test_ws_token_falso_y_bloqueo(tmp_path):
    c, pub, _ = make_client(tmp_path)
    for _ in range(5):
        with c.websocket_connect("/ws") as ws:
            ws.send_text(hello(secret="x" * 40))
            with pytest.raises(WebSocketDisconnect) as e:
                ws.receive_text()
            assert e.value.code == 4401
    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect("/ws"):
            pass
    assert e.value.code == 4429
    assert pub.sent == []


def test_ws_sin_hello(tmp_path):
    c, _, _ = make_client(tmp_path)
    with c.websocket_connect("/ws") as ws:
        ws.send_text("{}")
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_text()
        assert e.value.code == 4401


def test_ws_corta_tras_muchos_rechazos(tmp_path):
    c, pub, _ = make_client(tmp_path)
    with c.websocket_connect("/ws") as ws:
        ws.send_text(hello())
        ws.receive_json()
        with pytest.raises(WebSocketDisconnect) as e:
            for _ in range(80):
                ws.send_text("basura")
            ws.receive_text()
        assert e.value.code == 4400


def test_auditoria_sin_secretos_y_con_cadena_valida(tmp_path):
    c, _, cfg = make_client(tmp_path)
    with c.websocket_connect("/ws") as ws:
        ws.send_text(hello())
        ws.receive_json()
        ws.send_text(json.dumps(ENV))
    log = open(cfg.audit_path).read()
    assert make_token(SECRET, "phone-1") not in log and ENV["ct"] not in log and "device_connected" in log
    assert verify_chain(cfg.audit_path)


def test_cadena_de_auditoria_detecta_alteracion(tmp_path):
    p = tmp_path / "a.log"
    a = AuditLog(str(p))
    for i in range(4):
        a.write("evt", n=i)
    assert verify_chain(str(p))
    lines = p.read_text().splitlines()
    del lines[1]
    p.write_text("\n".join(lines) + "\n")
    assert not verify_chain(str(p))


def test_cabeceras_y_salud(tmp_path):
    c, _, _ = make_client(tmp_path)
    r = c.get("/healthz")
    assert r.json()["status"] == "UP"
    assert "default-src 'none'" in r.headers["content-security-policy"]


def test_solo_lo_que_es_culpa_del_celular_cuenta_para_el_corte():
    """Con el broker caído o tras reconectar el celular reenvía sin parar: eso no debe cortarlo."""
    from app.api.websocket import MAX_REJECTED, MAX_REPLAYS

    assert MAX_REJECTED == 50 and MAX_REPLAYS >= MAX_REJECTED
