"""Local preview and Live Photo conversion. Binds loopback; no external uploads."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import json
import mimetypes
import subprocess
import tempfile
import threading
import argparse
import shutil

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=4180)
PORT = parser.parse_args().port
if not 1024 <= PORT <= 65535:
    raise ValueError("Port must be between 1024 and 65535")
ORIGIN = f"http://127.0.0.1:{PORT}"
CONVERSION = threading.BoundedSemaphore(2)
STATIC = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/app.css": "app.css", "/assets/portraits.png": "assets/portraits.png", "/assets/landscapes.png": "assets/landscapes.png"}

# Only serve the local curated manifest and its explicitly listed image files.

STATIC["/selected-gallery.js"] = "selected-gallery.js"
STATIC["/gallery.js"] = "gallery.js"
STATIC["/travel-gallery.js"] = "travel-gallery.js"
STATIC["/drama-gallery.js"] = "drama-gallery.js"
for asset in json.loads((ROOT / "gallery.json").read_text()) + json.loads((ROOT / "drama-gallery.json").read_text()) + json.loads((ROOT / "selected-gallery.json").read_text()):
    for key in ("src", "thumb"):
        name = asset[key]
        parts = Path(name).parts
        if len(parts) != 3 or parts[:2] not in (("assets", "gallery-v4"), ("assets", "drama-v1"), ("assets", "user-selection-20260927")) or Path(name).suffix not in (".jpg", ".png"):
            raise ValueError("Unexpected gallery asset path")
        STATIC["/" + name] = name

STATIC["/music-catalog.js"] = "music-catalog.js"
STATIC["/music-library.js"] = "music-library.js"
for track in json.loads((ROOT / "music-catalog.json").read_text()):
    name = track["src"]
    p = Path(name)
    if len(p.parts) != 3 or p.parts[:2] != ("assets", "music-20260927") or p.suffix != ".m4a":
        raise ValueError("Unexpected music asset path")
    STATIC["/" + name] = name

class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, kind="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.headers.get("Host") != f"127.0.0.1:{PORT}":
            return self.reply(403, b'{}')
        name = STATIC.get(urlsplit(self.path).path)
        if name is None:
            return self.reply(404, b'{}')
        target = ROOT / name
        if target.is_symlink() or not target.resolve().is_relative_to(ROOT):
            return self.reply(403, b'{}')
        self.reply(200, target.read_bytes(), mimetypes.guess_type(name)[0] or "application/octet-stream")

    def do_POST(self):
        # Reject cross-site requests before reading or creating any files.
        if (self.headers.get("Host") != f"127.0.0.1:{PORT}" or
            self.headers.get("Origin") != ORIGIN or
            self.headers.get("X-Orbit-Convert") != "1"):
            return self.reply(403, b'{}')
        kind = {"/convert/heic": "heic", "/convert/video": "mov"}.get(self.path)
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            size = 0
        limit = (40 if kind == "heic" else 150) * 1024 * 1024
        if kind is None or size <= 0 or size > limit:
            return self.reply(400, b'{}')
        if not CONVERSION.acquire(blocking=False):
            return self.reply(429, b'{}')
        # Fixed filenames in a newly allocated private directory, never user paths.
        folder = Path(tempfile.mkdtemp(prefix="photo-orbit-convert-"))
        source, output = folder / ("input." + kind), folder / ("output.jpg" if kind == "heic" else "output.mp4")
        try:
            self.connection.settimeout(60)
            with source.open("xb") as f:
                remaining = size
                while remaining:
                    chunk = self.rfile.read(min(remaining, 1024 * 1024))
                    if not chunk:
                        raise ValueError("Incomplete upload")
                    f.write(chunk)
                    remaining -= len(chunk)
            signature = source.open("rb").read(16)
            if len(signature) < 12 or signature[4:8] not in (b"ftyp", b"moov", b"mdat", b"wide", b"free"):
                raise ValueError("Unsupported container")
            if kind == "heic":
                command = ["/usr/bin/sips", "-s", "format", "jpeg", str(source), "--out", str(output)]
            else:
                command = [(shutil.which("ffmpeg") or "ffmpeg"), "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe", "-i", str(source), "-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", "-fs", "157286400", str(output)]
            subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
            if kind == "heic" and b"\xff\xda" not in output.read_bytes():
                # Some HEIC variants produce a metadata-only JPEG through sips.
                decoder = shutil.which("heif-convert")
                if not decoder:
                    raise ValueError("HEIC decoder unavailable; export JPEG from Photos")
                output.unlink()  # exact output owned by this request
                subprocess.run([decoder, str(source), str(output)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
                if b"\xff\xda" not in output.read_bytes():
                    raise ValueError("Invalid JPEG output")
            if output.stat().st_size > limit:
                raise ValueError("Converted file too large")
            self.reply(200, output.read_bytes(), "image/jpeg" if kind == "heic" else "video/mp4")
        except (ValueError, OSError, subprocess.SubprocessError):
            self.reply(422, json.dumps({"error": "文件无法转换，请重新导出原片后重试。"}, ensure_ascii=False).encode())
        finally:
            # Delete only the two exact files this request created; no recursive cleanup.
            for file in (source, output):
                if file.is_file() and not file.is_symlink():
                    file.unlink()
            folder.rmdir()
            CONVERSION.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
