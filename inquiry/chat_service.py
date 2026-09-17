"""
HTTP Chat Service for rule-based inquiry chatbot.
Runs in-process HTTP server importing normalize, match_inquiry, and responses.
No separate process is spawned per message.
"""
import os
import sys
import json
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from typing import Optional

# Ensure inquiry folder is in sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from match_inquiry import InquiryMatcher, load_faq
from responses import format_inquiry_response, build_topic_pill


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class InquiryRequestHandler(BaseHTTPRequestHandler):
    # Injected class attributes
    matcher: InquiryMatcher = None
    faq_data: dict = None

    def _set_cors_headers(self, status_code: int = 200, content_type: str = "application/json"):
        self.send_response(status_code)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self._set_cors_headers(204)

    def do_GET(self):
        """Handle GET requests for health and topic listing."""
        path = self.path.split("?")[0]
        if path in ("/health", "/api/health"):
            data = {
                "status": "ok",
                "service": "skti-inquiry-service",
                "version": "1.0.0",
                "facility": self.faq_data.get("facility", ""),
                "topics_count": len(self.faq_data.get("topics", [])),
            }
            self._set_cors_headers(200)
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        if path in ("/api/inquiry/topics", "/topics"):
            topics = [build_topic_pill(t) for t in self.faq_data.get("topics", [])]
            data = {
                "success": True,
                "topics": topics,
                "facility": self.faq_data.get("facility", ""),
            }
            self._set_cors_headers(200)
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        self._set_cors_headers(404)
        self.wfile.write(json.dumps({"error": "Not Found"}).encode("utf-8"))

    def do_POST(self):
        """Handle POST inquiry chat requests."""
        path = self.path.split("?")[0]
        if path not in ("/api/inquiry", "/chat", "/api/inquiry/chat"):
            self._set_cors_headers(404)
            self.wfile.write(json.dumps({"error": f"Endpoint {path} not found"}).encode("utf-8"))
            return

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 100000:
            self._set_cors_headers(413)
            self.wfile.write(json.dumps({"error": "Payload too large"}).encode("utf-8"))
            return

        try:
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode("utf-8") or "{}")
        except Exception as e:
            self._set_cors_headers(400)
            self.wfile.write(json.dumps({"error": f"Invalid JSON body: {str(e)}"}).encode("utf-8"))
            return

        # Extract fields
        query = body.get("query") or body.get("question") or ""
        topic_id = body.get("topic_id") or body.get("topicId")

        # In-process match execution
        match_result = self.matcher.match(query=query, topic_id=topic_id)

        # Format approved response
        all_topics = self.faq_data.get("topics", [])
        response_payload = format_inquiry_response(match_result, all_topics, self.faq_data)

        self._set_cors_headers(200)
        self.wfile.write(json.dumps(response_payload, ensure_ascii=False).encode("utf-8"))

    def log_message(self, format, *args):
        """Clean minimal logging to stderr."""
        sys.stderr.write(f"[InquiryService] {format % args}\n")


def create_service(faq_path: Optional[str] = None):
    faq_data = load_faq(faq_path)
    matcher = InquiryMatcher(faq_path)
    InquiryRequestHandler.matcher = matcher
    InquiryRequestHandler.faq_data = faq_data
    return matcher, faq_data


def run_server(host: str = "127.0.0.1", port: int = 5005, faq_path: Optional[str] = None):
    create_service(faq_path)
    server_address = (host, port)
    httpd = ThreadedHTTPServer(server_address, InquiryRequestHandler)
    print(f"[InquiryService] Running on http://{host}:{port}/")
    print(f"[InquiryService] Endpoints: POST /api/inquiry, GET /health, GET /api/inquiry/topics")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[InquiryService] Shutting down...")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SPMC SKTI Rule-Based Inquiry Chat Service")
    parser.add_argument("--host", default=os.getenv("INQUIRY_HOST", "127.0.0.1"), help="Host address")
    parser.add_argument("--port", type=int, default=int(os.getenv("INQUIRY_PORT", "5005")), help="Port")
    parser.add_argument("--faq", default=None, help="Path to custom faq.json")
    args = parser.parse_args()

    run_server(host=args.host, port=args.port, faq_path=args.faq)
