#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NGROK_BIN="${REPO_ROOT}/.tools/ngrok/ngrok"
PORT="${PORT:-3000}"

if [[ ! -x "${NGROK_BIN}" ]]; then
  echo "ngrok binary not found at ${NGROK_BIN}" >&2
  echo "Expected a local install under .tools/ngrok/." >&2
  exit 1
fi

if [[ -z "${NGROK_AUTHTOKEN:-}" ]]; then
  echo "NGROK_AUTHTOKEN is required." >&2
  echo "Export it first, then rerun this command." >&2
  exit 1
fi

exec "${NGROK_BIN}" http "${PORT}" \
  --authtoken "${NGROK_AUTHTOKEN}" \
  --log stdout
