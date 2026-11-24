"""Sirve SOLO el certificado público de la CA para instalarlo en el celular."""
from __future__ import annotations

import http.server
import threading
from pathlib import Path


def serve_ca_certificate(ca_file: str, port: int) -> threading.Thread:
    data = Path(ca_file).read_bytes()

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            if self.path.split("?")[0] != "/ca.crt":
                return self.send_error(404)
            self.send_response(200)
            self.send_header("Content-Type", "application/x-x509-ca-cert")
            self.send_header("Content-Disposition", 'attachment; filename="volvo-ca.crt"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True, name="ca-server")
    thread.start()
    return thread
