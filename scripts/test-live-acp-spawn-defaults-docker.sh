#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${EVE_LIVE_ACP_BIND_AGENTS:-}" && "${EVE_LIVE_ACP_BIND_AGENTS}" != "codex" ]]; then
  echo "ERROR: ACP spawn defaults Docker test supports only EVE_LIVE_ACP_BIND_AGENTS=codex." >&2
  exit 1
fi

export EVE_LIVE_ACP_BIND_AGENTS=codex
export EVE_LIVE_ACP_BIND_TEST_FILES="${EVE_LIVE_ACP_BIND_TEST_FILES:-src/gateway/gateway-acp-spawn-defaults.live.test.ts}"
export EVE_LIVE_ACP_SPAWN_DEFAULTS=1
export EVE_LIVE_ACP_SPAWN_DEFAULTS_MODEL="${EVE_LIVE_ACP_SPAWN_DEFAULTS_MODEL:-openai/gpt-5.5}"
export EVE_LIVE_ACP_SPAWN_DEFAULTS_THINKING="${EVE_LIVE_ACP_SPAWN_DEFAULTS_THINKING:-high}"
export EVE_LIVE_ACP_BIND_CODEX_MODEL="${EVE_LIVE_ACP_BIND_CODEX_MODEL:-gpt-5.5}"

exec bash "$SCRIPT_DIR/test-live-acp-bind-docker.sh"
