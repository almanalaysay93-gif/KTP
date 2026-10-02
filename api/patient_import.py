"""
Vercel Python function: reads a patient list file and returns the patients as JSON.

Route: POST /api/patient_import with a JSON body {"fileName": "...", "base64": "..."}.
The reader is scripts/patient_list_reader.py. This function does not write to the database:
the browser sends the checked patients to the tRPC procedure patientImport.commit,
which needs an admin session.

Access: the request must carry a session cookie that this application signed.
On a development machine the Express server answers the same route (server/patientImportRoute.ts).
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

from patient_list_reader import parse_bytes  # noqa: E402

COOKIE_NAME = "app_session_id"
# Vercel refuses a request body over 4.5 MB. Base64 adds one third, so the file limit is 3 MB.
MAX_FILE_BYTES = 3 * 1024 * 1024
DEV_SECRET = "skti-default-jwt-secret-key-32-chars-min!"


def b64url(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def session_is_valid(cookie_header: str) -> bool:
    """True when the session cookie has a good HS256 signature and is not expired."""
    secret = os.environ.get("JWT_SECRET") or ("" if os.environ.get("VERCEL_ENV") == "production" else DEV_SECRET)
    if not secret:
        return False
    token = ""
    for part in (cookie_header or "").split(";"):
        name, _, value = part.strip().partition("=")
        if name == COOKIE_NAME:
            token = value
    pieces = token.split(".")
    if len(pieces) != 3:
        return False
    try:
        header = json.loads(b64url(pieces[0]))
        payload = json.loads(b64url(pieces[1]))
        signature = b64url(pieces[2])
    except Exception:
        return False
    if header.get("alg") != "HS256":
        return False
    expected = hmac.new(secret.encode(), f"{pieces[0]}.{pieces[1]}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        return False
    return bool(payload.get("openId")) and float(payload.get("exp", 0)) > time.time()


class handler(BaseHTTPRequestHandler):
    def reply(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        if not session_is_valid(self.headers.get("Cookie", "")):
            self.reply(401, {"success": False, "rows": [], "error": "Sign in again, then upload the file."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            request = json.loads(self.rfile.read(length))
            file_name = str(request["fileName"])[:255]
            data = base64.b64decode(str(request["base64"]).split("base64,")[-1])
        except Exception:
            self.reply(400, {"success": False, "rows": [], "error": "The upload was not complete. Try again."})
            return
        if len(data) > MAX_FILE_BYTES:
            self.reply(413, {"success": False, "rows": [], "error": "File too large. The maximum size is 3 MB."})
            return
        self.reply(200, parse_bytes(data, file_name))

    def do_GET(self) -> None:
        self.reply(405, {"success": False, "rows": [], "error": "Use POST."})

    def log_message(self, *args) -> None:  # No request lines in the log: file names can hold patient names.
        pass
