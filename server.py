#!/usr/bin/env python3
"""Small, dependency-free web server for the iPhone Duo demo."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))

class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[http] %s - %s" % (self.address_string(), fmt % args), flush=True)

if __name__ == "__main__":
    if not (ROOT / "index.html").is_file():
        raise SystemExit("index.html was not found next to server.py")
    httpd = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"iPhone Duo server listening on http://{HOST}:{PORT}", flush=True)
    try:
        httpd.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print("Shutting down server...", flush=True)
    finally:
        httpd.server_close()
