#!/usr/bin/env bash
# Start the FastAPI backend (port 8000) and the Next.js frontend (port 3000) together.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM
( cd "$ROOT/backend" && python3 -m uvicorn app.main:app --reload --port 8000 ) &
( cd "$ROOT/frontend" && npm run dev ) &
echo "Music Decoder: open http://localhost:3000  (API on http://localhost:8000/docs)"
wait
