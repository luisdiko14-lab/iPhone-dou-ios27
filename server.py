#!/usr/bin/env python3
"""iPhone Duo OS backend (Python standard library only).

    python3 server.py              # http://127.0.0.1:8027
    python3 server.py --port 9000

Serves the web OS and a small JSON API that the apps use when it is running:

    GET    /api/ping                      health check
    GET    /api/state   PUT /api/state    sync of the OS state (notes, settings, ...)
    GET    /api/files?path=               list a folder inside ./storage
    GET    /api/file?path=                read a file       PUT  write a file
    DELETE /api/file?path=                delete a file or folder
    POST   /api/mkdir?path=               create a folder
    GET    /api/sysinfo                   host information
    GET    /api/messages?since=<id>       chat Room  (POST to send)

The OS works without this server (e.g. on GitHub Pages); the server only adds
real file storage, cross-device state sync and a shared chat room.

Safety: binds to 127.0.0.1 by default, checks Host/Origin (DNS-rebinding and
cross-site request defence), serves only an allowlist of static paths, confines
all file access to ./storage, caps body sizes, and never executes anything.
"""
import argparse
import json
import mimetypes
import os
import platform
import shutil
import socket
import sys
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.realpath(__file__))
STORAGE = os.path.join(ROOT, "storage")
DATA = os.path.join(ROOT, "data")
STATE_FILE = os.path.join(DATA, "state.json")
MAX_BODY = 5 * 1024 * 1024
MAX_STATE = 20 * 1024 * 1024
STATIC_DIRS = ("css", "js", "assets")
STATIC_FILES = {"index.html", "favicon.ico"}
START = time.time()
VERSION = "2.0"

_lock = threading.Lock()
_messages = []          # chat room (memory only; cleared on restart)
_next_id = 1


class ApiError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status, self.msg = status, msg


def safe_path(rel):
    """Resolve a user path inside ./storage. Raises ApiError if it escapes."""
    rel = (rel or "/").replace("\\", "/")
    if "\x00" in rel:
        raise ApiError(400, "Bad path")
    full = os.path.realpath(os.path.join(STORAGE, rel.lstrip("/")))
    base = os.path.realpath(STORAGE)
    if full != base and not full.startswith(base + os.sep):
        raise ApiError(403, "Path outside storage")
    return full


def sysinfo():
    info = {
        "host": socket.gethostname(),
        "os": platform.system() + " " + platform.release(),
        "python": platform.python_version(),
        "cpus": os.cpu_count() or 1,
        "server": "duo-server " + VERSION,
        "uptime": "%d s" % (time.time() - START),
    }
    try:
        l1, l5, l15 = os.getloadavg()
        info["load"] = "%.2f %.2f %.2f" % (l1, l5, l15)
    except (OSError, AttributeError):
        pass
    try:
        du = shutil.disk_usage(ROOT)
        info["disk"] = "%.1f / %.1f GB" % ((du.total - du.free) / 1e9, du.total / 1e9)
    except OSError:
        pass
    try:
        with open("/proc/meminfo") as f:
            m = {l.split(":")[0]: int(l.split()[1]) for l in f if ":" in l}
        info["memory"] = "%.0f / %.0f MB" % ((m["MemTotal"] - m["MemAvailable"]) / 1024, m["MemTotal"] / 1024)
    except (OSError, KeyError, ValueError, IndexError):
        pass
    info["time"] = time.strftime("%Y-%m-%d %H:%M:%S")
    return info


class Handler(BaseHTTPRequestHandler):
    server_version = "DuoServer/" + VERSION
    protocol_version = "HTTP/1.1"

    # ---- plumbing -------------------------------------------------------
    def log_message(self, fmt, *a):
        if not getattr(self.server, "quiet", False):
            sys.stderr.write("%s  %s\n" % (self.address_string(), fmt % a))

    def _host_ok(self):
        host = (self.headers.get("Host") or "").lower()
        name = host.rsplit(":", 1)[0] if not host.startswith("[") else host.split("]")[0] + "]"
        allowed = self.server.allowed_hosts
        return "*" in allowed or name in allowed

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        return urlparse(origin).netloc.lower() == (self.headers.get("Host") or "").lower()

    def _send(self, status, body=b"", ctype="application/json", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _read_body(self, limit):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ApiError(400, "Bad Content-Length")
        if n < 0 or n > limit:
            raise ApiError(413, "Body too large (limit %d bytes)" % limit)
        return self.rfile.read(n) if n else b""

    def _json_body(self, limit=MAX_BODY):
        try:
            return json.loads(self._read_body(limit) or b"null")
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "Invalid JSON")

    def _dispatch(self):
        try:
            if not self._host_ok():
                raise ApiError(403, "Host not allowed")
            u = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(u.query).items()}
            path = u.path
            if path.startswith("/api/"):
                if self.command not in ("GET", "HEAD") and not self._origin_ok():
                    raise ApiError(403, "Cross-origin request blocked")
                return self._api(path[5:], q)
            if self.command not in ("GET", "HEAD"):
                raise ApiError(405, "Method not allowed")
            return self._static(path)
        except ApiError as e:
            self._send(e.status, {"error": e.msg})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # never leak a traceback to the client
            sys.stderr.write("error: %r\n" % (e,))
            self._send(500, {"error": "Internal error"})

    do_GET = do_PUT = do_POST = do_DELETE = do_HEAD = _dispatch

    # ---- static ---------------------------------------------------------
    def _static(self, path):
        path = "/index.html" if path == "/" else path
        rel = path.lstrip("/")
        parts = rel.split("/")
        if ".." in parts or "\x00" in rel or "\\" in rel:
            raise ApiError(404, "Not found")
        if not (rel in STATIC_FILES or (len(parts) > 1 and parts[0] in STATIC_DIRS)):
            raise ApiError(404, "Not found")
        full = os.path.realpath(os.path.join(ROOT, rel))
        if not full.startswith(ROOT + os.sep) or not os.path.isfile(full):
            raise ApiError(404, "Not found")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            self._send(200, f.read(), ctype)

    # ---- api ------------------------------------------------------------
    def _api(self, route, q):
        m = self.command
        if route == "ping" and m in ("GET", "HEAD"):
            return self._send(200, {"duo": True, "version": VERSION, "name": "Duo Server", "time": time.time()})
        if route == "sysinfo" and m == "GET":
            return self._send(200, sysinfo())
        if route == "state":
            if m == "GET":
                try:
                    with open(STATE_FILE, "rb") as f:
                        return self._send(200, f.read())
                except FileNotFoundError:
                    return self._send(200, {})
            if m == "PUT":
                data = self._json_body(MAX_STATE)
                if not isinstance(data, dict):
                    raise ApiError(400, "State must be an object")
                os.makedirs(DATA, exist_ok=True)
                tmp = STATE_FILE + ".tmp"
                with _lock:
                    with open(tmp, "w", encoding="utf-8") as f:
                        json.dump(data, f)
                    os.replace(tmp, STATE_FILE)
                return self._send(200, {"ok": True})
        if route == "files" and m == "GET":
            full = safe_path(q.get("path"))
            if not os.path.isdir(full):
                raise ApiError(404, "Not a folder")
            out = []
            for name in sorted(os.listdir(full), key=str.lower):
                p = os.path.join(full, name)
                try:
                    st = os.stat(p)
                except OSError:
                    continue
                out.append({"name": name, "dir": os.path.isdir(p), "size": st.st_size, "mtime": st.st_mtime})
            out.sort(key=lambda e: (not e["dir"], e["name"].lower()))
            return self._send(200, {"path": q.get("path") or "/", "entries": out})
        if route == "file":
            full = safe_path(q.get("path"))
            if m == "GET":
                if not os.path.isfile(full):
                    raise ApiError(404, "No such file")
                if os.path.getsize(full) > MAX_BODY:
                    raise ApiError(413, "File too large to open")
                with open(full, "rb") as f:
                    return self._send(200, f.read(), "text/plain; charset=utf-8")
            if m == "PUT":
                if full == os.path.realpath(STORAGE) or os.path.isdir(full):
                    raise ApiError(400, "Is a folder")
                body = self._read_body(MAX_BODY)
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, "wb") as f:
                    f.write(body)
                return self._send(200, {"ok": True, "size": len(body)})
            if m == "DELETE":
                if full == os.path.realpath(STORAGE):
                    raise ApiError(400, "Cannot delete the storage root")
                if os.path.isdir(full):
                    shutil.rmtree(full)
                elif os.path.isfile(full):
                    os.remove(full)
                else:
                    raise ApiError(404, "No such file")
                return self._send(200, {"ok": True})
        if route == "mkdir" and m == "POST":
            full = safe_path(q.get("path"))
            if os.path.exists(full):
                raise ApiError(409, "Already exists")
            os.makedirs(full)
            return self._send(200, {"ok": True})
        if route == "messages":
            global _next_id
            if m == "GET":
                try:
                    since = int(q.get("since") or 0)
                except ValueError:
                    since = 0
                with _lock:
                    msgs = [x for x in _messages if x["id"] > since]
                    now = _next_id - 1
                return self._send(200, {"messages": msgs, "now": now})
            if m == "POST":
                d = self._json_body(16 * 1024)
                if not isinstance(d, dict) or not str(d.get("text", "")).strip():
                    raise ApiError(400, "Empty message")
                with _lock:
                    msg = {"id": _next_id, "ts": time.time(), "from": str(d.get("from", ""))[:40],
                           "name": str(d.get("name", "Device"))[:40], "text": str(d["text"]).strip()[:500],
                           "cid": str(d.get("cid", ""))[:40]}
                    _next_id += 1
                    _messages.append(msg)
                    del _messages[:-500]
                return self._send(200, {"ok": True, "id": msg["id"]})
        raise ApiError(404 if m in ("GET", "HEAD") else 405, "Unknown endpoint")


def main():
    ap = argparse.ArgumentParser(description="iPhone Duo OS backend")
    ap.add_argument("--host", default="127.0.0.1", help="bind address (default 127.0.0.1; use 0.0.0.0 for LAN)")
    ap.add_argument("--port", type=int, default=8027)
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()
    os.makedirs(STORAGE, exist_ok=True)
    seed = os.path.join(STORAGE, "hello.txt")
    if not os.listdir(STORAGE):
        with open(seed, "w") as f:
            f.write("This file lives on the Python server, in ./storage.\nEdit it from the Files app (Server tab).\n")
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    srv.daemon_threads = True
    srv.quiet = a.quiet
    # Host header allowlist. Binding to all interfaces means LAN names are expected, so relax it.
    srv.allowed_hosts = {"*"} if a.host in ("0.0.0.0", "::") else {"localhost", "127.0.0.1", "[::1]", a.host.lower()}
    print("iPhone Duo OS  →  http://%s:%d/   (Ctrl+C to stop)" % ("localhost" if a.host == "127.0.0.1" else a.host, a.port))
    if a.host in ("0.0.0.0", "::"):
        print("warning: listening on all interfaces; anyone on your network can read and write ./storage")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
