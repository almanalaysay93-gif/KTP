"""
Vercel Python function that hosts the rule-based inquiry service.

vercel.json rewrites /api/py/<path> to this function. The request keeps its
original path, so the /api/py prefix is removed before the shared handler in
inquiry/chat_service.py routes it. Set INQUIRY_SERVICE_URL to
https://<host>/api/py and set INQUIRY_SERVICE_SECRET before this is deployed:
without the secret the protected endpoints are open.
"""
import os
import sys

INQUIRY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "inquiry")
if INQUIRY_DIR not in sys.path:
    sys.path.insert(0, INQUIRY_DIR)

from chat_service import InquiryRequestHandler, create_service  # noqa: E402

PREFIX = "/api/py"

create_service()


def strip_prefix(path: str) -> str:
    if path == PREFIX or path.startswith(PREFIX + "/") or path.startswith(PREFIX + "?"):
        rest = path[len(PREFIX):]
        return rest if rest.startswith("/") else "/" + rest
    return path


class handler(InquiryRequestHandler):
    def do_OPTIONS(self):
        self.path = strip_prefix(self.path)
        super().do_OPTIONS()

    def do_GET(self):
        self.path = strip_prefix(self.path)
        super().do_GET()

    def do_POST(self):
        self.path = strip_prefix(self.path)
        super().do_POST()
