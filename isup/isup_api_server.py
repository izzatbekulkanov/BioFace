#!/usr/bin/env python3
"""
BioFace ISUP API proxy server.
SDK serverdan (port 7680 ichki) HTTP orqali ma'lumot oladi va 7670 da taqdim etadi.
Bu alohida process'da ishlatiladi — SDK GIL muammosidan butunlay xoli.
"""
import json
import socketserver
import sys
import signal
import time
from http.server import BaseHTTPRequestHandler
from urllib.request import urlopen
from urllib.parse import urlparse, parse_qs
from urllib.error import URLError


SDK_INTERNAL_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7680
API_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 7670


class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS")
        self.end_headers()

    def _proxy(self, method="GET"):
        parsed = urlparse(self.path)
        path = parsed.path
        url = f"http://127.0.0.1:{SDK_INTERNAL_PORT}{path}"
        if parsed.query:
            url += f"?{parsed.query}"
        try:
            import urllib.request
            req = urllib.request.Request(url, method=method)
            with urllib.request.urlopen(req, timeout=3) as resp:
                body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
        except Exception as e:
            self._send_json({"error": str(e)}, status=502)

    def do_GET(self):
        self._proxy("GET")

    def do_DELETE(self):
        self._proxy("DELETE")


class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    srv = Server(("0.0.0.0", API_PORT), ProxyHandler)
    print(f"[ISUP API Proxy] Listening on 0.0.0.0:{API_PORT} → internal :{SDK_INTERNAL_PORT}", flush=True)

    stop = [False]

    def _sig(signum, frame):
        stop[0] = True
        srv.shutdown()

    signal.signal(signal.SIGTERM, _sig)
    signal.signal(signal.SIGINT, _sig)

    import threading
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()

    while not stop[0]:
        time.sleep(0.5)


if __name__ == "__main__":
    main()
