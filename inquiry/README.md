# SPMC SKTI Rule-Based Inquiry Service

Standalone Python microservice that powers the rule-based General Inquiries chatbot for Southern Philippines Medical Center Kidney Transplant Institute (SPMC SKTI).

## 1. Startup

Run directly with Python 3.10+:
```bash
python inquiry/chat_service.py
```

Or via package.json script:
```bash
pnpm inquiry:start
```

Custom port and host:
```bash
python inquiry/chat_service.py --host 0.0.0.0 --port 5005
```

Run test suite:
```bash
python inquiry/test_inquiry.py
# or
pnpm test:inquiry
```

## 2. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` or `INQUIRY_PORT` | `5005` | Port the HTTP service binds to |
| `HOST` or `INQUIRY_HOST` | `0.0.0.0` | Host interface the service listens on |
| `INQUIRY_SERVICE_SECRET` | None (disabled) | Shared secret for authentication (`Bearer <secret>` or `X-Inquiry-Secret`) |
| `FAQ_PATH` | `inquiry/faq.json` | Path to approved FAQ JSON file |
| `INQUIRY_SERVICE_URL` | `http://127.0.0.1:5005` | URL configured on Node/Vercel server to reach this service |

## 3. Endpoints & Health Checks

- `GET /health` (Public):
  Health probe for cloud orchestrators and uptime monitors. Returns `200 OK` with service name, version, and topic count.
- `GET /api/inquiry/topics` (Protected if secret set):
  Returns list of all 8 core approved topics.
- `POST /api/inquiry` (Protected if secret set):
  Accepts `{ query?: string, topic_id?: string, context?: object }` and returns verified answer payload without any model or LLM calls.
- `POST /api/insights/report` (Protected if secret set):
  Accepts `{ digest: object }` from the Node server and returns the rule-based Insights report sections S1 to S5 (`inquiry/insights_report.py`).
  It makes no model call, and it returns HTTP 400 for a digest with the wrong shape.
