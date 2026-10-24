#!/usr/bin/env bash
# Run every check: backend tests, frontend unit tests, type-check, production build.
# Browser tests need both servers running:  cd frontend && npm run test:e2e
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "== backend (pytest)";   ( cd "$ROOT/backend" && python3 -m pytest )
echo "== frontend (vitest)";  ( cd "$ROOT/frontend" && npm test )
echo "== type-check";         ( cd "$ROOT/frontend" && npm run typecheck )
echo "== build";              ( cd "$ROOT/frontend" && npm run build )
