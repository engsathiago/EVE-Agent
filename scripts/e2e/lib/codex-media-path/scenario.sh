#!/usr/bin/env bash
set -euo pipefail

source scripts/lib/eve-e2e-instance.sh
eve_e2e_eval_test_state_from_b64 "${EVE_TEST_STATE_SCRIPT_B64:?missing EVE_TEST_STATE_SCRIPT_B64}"
export EVE_SKIP_CHANNELS=1
export EVE_SKIP_GMAIL_WATCHER=1
export EVE_SKIP_CRON=1
export EVE_SKIP_CANVAS_HOST=1
export EVE_SKIP_BROWSER_CONTROL_SERVER=1
export EVE_SKIP_ACPX_RUNTIME=1
export EVE_SKIP_ACPX_RUNTIME_PROBE=1
export EVE_AGENT_HARNESS_FALLBACK=none
export EVE_CODEX_MEDIA_PATH_APP_SERVER_LOG="/tmp/eve-codex-media-path-app-server.jsonl"

PORT="${PORT:?missing PORT}"
TOKEN="${EVE_GATEWAY_TOKEN:?missing EVE_GATEWAY_TOKEN}"
PLUGIN_SPEC="${EVE_CODEX_MEDIA_PATH_PLUGIN_SPEC:?missing EVE_CODEX_MEDIA_PATH_PLUGIN_SPEC}"
GATEWAY_LOG="/tmp/eve-codex-media-path-gateway.log"
CLIENT_LOG="/tmp/eve-codex-media-path-client.log"
PLUGIN_INSTALL_LOG="/tmp/eve-codex-media-path-plugin-install.log"
PLUGIN_INSPECT_LOG="/tmp/eve-codex-media-path-plugin-inspect.json"
gateway_pid=""

cleanup() {
  eve_e2e_stop_process "$gateway_pid"
}
trap cleanup EXIT

dump_debug_logs() {
  local status="$1"
  echo "Codex media-path Docker E2E failed with exit code $status" >&2
  eve_e2e_dump_logs "$PLUGIN_INSTALL_LOG" "$PLUGIN_INSPECT_LOG" "$GATEWAY_LOG" "$CLIENT_LOG" "$EVE_CODEX_MEDIA_PATH_APP_SERVER_LOG"
}
trap 'status=$?; dump_debug_logs "$status"; exit "$status"' ERR

entry="$(eve_e2e_resolve_entrypoint)"
mkdir -p "$EVE_STATE_DIR" "$EVE_TEST_WORKSPACE_DIR"
rm -f "$EVE_CODEX_MEDIA_PATH_APP_SERVER_LOG"

eve_e2e_enable_eve_cli_timeout

echo "Installing Codex plugin: $PLUGIN_SPEC"
eve plugins install "$PLUGIN_SPEC" --force >"$PLUGIN_INSTALL_LOG" 2>&1
eve plugins inspect codex --runtime --json >"$PLUGIN_INSPECT_LOG"

node scripts/e2e/lib/codex-media-path/write-config.mjs

gateway_pid="$(eve_e2e_start_gateway "$entry" "$PORT" "$GATEWAY_LOG")"
eve_e2e_wait_gateway_ready "$gateway_pid" "$GATEWAY_LOG" 480 "$PORT"

PORT="$PORT" EVE_GATEWAY_TOKEN="$TOKEN" \
  tsx scripts/e2e/lib/codex-media-path/client.mjs >"$CLIENT_LOG" 2>&1

eve_e2e_print_log "$CLIENT_LOG"
echo "Codex media-path Docker E2E passed"
