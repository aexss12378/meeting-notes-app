#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"

cd "${ROOT_DIR}"

log() {
  printf '[open-app] %s\n' "$1"
}

warn() {
  printf '[open-app] warning: %s\n' "$1" >&2
}

fail() {
  printf '[open-app] %s\n' "$1" >&2
  exit 1
}

resolve_probe_url() {
  local raw_url="${1%/}"

  if [[ -z "${raw_url}" ]]; then
    echo ""
    return
  fi

  if [[ "${raw_url}" == */api/chat ]]; then
    echo "${raw_url%/chat}/tags"
    return
  fi

  if [[ "${raw_url}" == */api/generate ]]; then
    echo "${raw_url%/generate}/tags"
    return
  fi

  if [[ "${raw_url}" == */api ]]; then
    echo "${raw_url}/tags"
    return
  fi

  echo "${raw_url}/api/tags"
}

wait_for_docker() {
  local retries=45

  while (( retries > 0 )); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    retries=$((retries - 1))
  done

  return 1
}

wait_for_url() {
  local url="$1"
  local retries=45

  while (( retries > 0 )); do
    if curl -fsS --max-time 5 "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    retries=$((retries - 1))
  done

  return 1
}

if [[ -f ".env" ]]; then
  set -a
  source ".env"
  set +a
fi

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker CLI is not installed."
fi

if ! docker info >/dev/null 2>&1; then
  log "Docker Desktop is not running. Opening Docker..."
  open -a Docker >/dev/null 2>&1 || true

  if ! wait_for_docker; then
    fail "Docker did not become ready. Start Docker Desktop and run 'make open-app' again."
  fi
fi

if [[ -z "${OLLAMA_BASE_URL:-}" ]]; then
  warn "OLLAMA_BASE_URL is empty in .env. The app can open, but processing will not work."
else
  PROBE_URL="$(resolve_probe_url "${OLLAMA_BASE_URL}")"
  if ! curl -fsS --connect-timeout 5 --max-time 10 "${PROBE_URL}" >/dev/null 2>&1; then
    warn "Cannot reach remote model endpoint (${PROBE_URL}). The app will still open, but processing may fail until VPN or the remote service is back."
  fi
fi

log "Starting containers..."
docker compose --project-name meeting_notes up -d --build

log "Waiting for API live endpoint..."
if ! wait_for_url "http://localhost:8000/health/live"; then
  fail "API did not become live in time. Run 'make logs' to inspect the stack."
fi

log "Waiting for frontend..."
if ! wait_for_url "http://localhost:3000"; then
  fail "Frontend did not become ready in time. Run 'make logs' to inspect the stack."
fi

log "Opening app..."
open "http://localhost:3000"

log "App is ready at http://localhost:3000"
