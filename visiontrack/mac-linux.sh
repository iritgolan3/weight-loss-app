#!/usr/bin/env bash
# VisionTrack - one-click start for macOS / Linux.
#   ./mac-linux.sh         build the UI and serve everything on :8000
#   ./mac-linux.sh --dev   run the backend plus the Vite dev server on :5173
set -euo pipefail
cd "$(dirname "$0")"

command -v python3 >/dev/null || { echo "python3 is required (3.10-3.12)"; exit 1; }
command -v node    >/dev/null || { echo "Node.js is required (LTS)"; exit 1; }

PY=backend/.venv/bin/python
[ -x "$PY" ] || { echo "[1/4] Creating the Python virtual environment..."; python3 -m venv backend/.venv; }

echo "[2/4] Installing Python dependencies..."
"$PY" -m pip install --upgrade pip --quiet
"$PY" -m pip install -r backend/requirements.txt

[ -d frontend/node_modules ] || { echo "[3/4] Installing frontend dependencies..."; (cd frontend && npm install); }

if [ "${1:-}" = "--dev" ]; then
  echo "[4/4] Starting backend (:8000) and Vite dev server (:5173)..."
  "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --app-dir backend &
  BACKEND_PID=$!
  trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT
  (cd frontend && npm run dev)
  exit 0
fi

echo "[4/4] Building the user interface..."
(cd frontend && npm run build)

echo
echo "VisionTrack is starting on http://localhost:8000"
exec "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend
