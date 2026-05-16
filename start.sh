#!/usr/bin/env bash
set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${CYAN}[start]${NC} $*"; }
ok()    { echo -e "${GREEN}[start]${NC} $*"; }
warn()  { echo -e "${YELLOW}[start]${NC} $*"; }
die()   { echo -e "${RED}[start]${NC} $*" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
ENV_FILE="$ROOT/.env.local"

# ── Cleanup on exit ────────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  info "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  ok "Done."
}
trap cleanup EXIT INT TERM

# ── Dependency checks ──────────────────────────────────────────────────────────
command -v go      &>/dev/null || die "go not found. Install Go 1.22+."
command -v npm     &>/dev/null || die "npm not found. Install Node.js 20+."
command -v psql    &>/dev/null || warn "psql not found — skipping DB connectivity check."

# ── Load environment ──────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  info "Loading $ENV_FILE"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
else
  warn ".env.local not found — using shell environment."
  warn "Copy .env.example to .env.local and fill in values to configure."
fi

# ── Required env vars ─────────────────────────────────────────────────────────
[[ -z "${DATABASE_URL:-}" ]] && die "DATABASE_URL is not set."
[[ -z "${JWT_SECRET:-}"   ]] && die "JWT_SECRET is not set."

# ── Optional defaults for local dev ───────────────────────────────────────────
export UPLOAD_DIR="${UPLOAD_DIR:-/tmp/autodoc-uploads}"
export ENV="${ENV:-development}"
export WORKER_POOL_SIZE="${WORKER_POOL_SIZE:-2}"
export MIGRATIONS_PATH="${MIGRATIONS_PATH:-$BACKEND/migrations}"
export PORT="${PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

mkdir -p "$UPLOAD_DIR"

# ── Frontend deps ──────────────────────────────────────────────────────────────
if [[ ! -d "$FRONTEND/node_modules" ]]; then
  info "Installing frontend dependencies..."
  (cd "$FRONTEND" && npm install --silent)
fi

# ── Start backend ──────────────────────────────────────────────────────────────
info "Starting backend on :$PORT (ENV=$ENV)"
(
  cd "$BACKEND"
  go run ./cmd/server 2>&1 | sed "s/^/${CYAN}[backend]${NC} /"
) &
PIDS+=($!)

# Give the backend a moment to bind before printing frontend URL
sleep 1

# ── Start frontend ─────────────────────────────────────────────────────────────
info "Starting frontend on :$FRONTEND_PORT"
(
  cd "$FRONTEND"
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:$PORT}" \
    npm run dev -- --port "$FRONTEND_PORT" 2>&1 | sed "s/^/${GREEN}[frontend]${NC} /"
) &
PIDS+=($!)

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
ok "Services running. Press Ctrl+C to stop."
echo -e "  Backend  → ${CYAN}http://localhost:$PORT/api/v1/health${NC}"
echo -e "  Frontend → ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo ""

wait
