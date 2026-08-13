#!/usr/bin/env bash
# Installs a prepared EVE npm tarball in Docker, runs non-interactive
# onboarding for a channel, and verifies one mocked model turn through Gateway.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
source "$ROOT_DIR/scripts/lib/docker-e2e-package.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "eve-npm-onboard-channel-agent-e2e" EVE_NPM_ONBOARD_E2E_IMAGE)"
DOCKER_TARGET="${EVE_NPM_ONBOARD_DOCKER_TARGET:-bare}"
HOST_BUILD="${EVE_NPM_ONBOARD_HOST_BUILD:-1}"
PACKAGE_TGZ="${EVE_CURRENT_PACKAGE_TGZ:-}"
CHANNEL="${EVE_NPM_ONBOARD_CHANNEL:-telegram}"
JSON_ARTIFACT_MAX_BYTES="$(
  docker_e2e_read_positive_int_env EVE_NPM_ONBOARD_JSON_ARTIFACT_MAX_BYTES 1048576
)"
STATUS_TEXT_MAX_BYTES="$(
  docker_e2e_read_positive_int_env EVE_NPM_ONBOARD_STATUS_TEXT_MAX_BYTES 1048576
)"
run_log=""

cleanup() {
  if [ -n "${PACKAGE_TGZ:-}" ]; then
    docker_e2e_cleanup_package_tgz "$PACKAGE_TGZ"
  fi
  if [ -n "${run_log:-}" ]; then
    rm -f "$run_log"
  fi
}
trap cleanup EXIT

case "$CHANNEL" in
telegram | discord | slack) ;;
*)
  echo "EVE_NPM_ONBOARD_CHANNEL must be telegram, discord, or slack, got: $CHANNEL" >&2
  exit 1
  ;;
esac

docker_e2e_build_or_reuse "$IMAGE_NAME" npm-onboard-channel-agent "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "$DOCKER_TARGET"

prepare_package_tgz() {
  if [ -n "$PACKAGE_TGZ" ]; then
    PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz npm-onboard-channel-agent "$PACKAGE_TGZ")"
    return 0
  fi
  if [ "$HOST_BUILD" = "0" ] && [ -z "${EVE_CURRENT_PACKAGE_TGZ:-}" ]; then
    echo "EVE_NPM_ONBOARD_HOST_BUILD=0 requires EVE_CURRENT_PACKAGE_TGZ" >&2
    exit 1
  fi
  PACKAGE_TGZ="$(docker_e2e_prepare_package_tgz npm-onboard-channel-agent)"
}

prepare_package_tgz

docker_e2e_package_mount_args "$PACKAGE_TGZ"
run_log="$(docker_e2e_run_log npm-onboard-channel-agent)"
EVE_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 npm-onboard-channel-agent empty)"

echo "Running npm tarball onboard/channel/agent Docker E2E ($CHANNEL)..."
if ! docker_e2e_run_with_harness \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e EVE_NPM_ONBOARD_CHANNEL="$CHANNEL" \
  -e "EVE_NPM_ONBOARD_JSON_ARTIFACT_MAX_BYTES=$JSON_ARTIFACT_MAX_BYTES" \
  -e "EVE_NPM_ONBOARD_STATUS_TEXT_MAX_BYTES=$STATUS_TEXT_MAX_BYTES" \
  -e "EVE_TEST_STATE_SCRIPT_B64=$EVE_TEST_STATE_SCRIPT_B64" \
  "${DOCKER_E2E_PACKAGE_ARGS[@]}" \
  -i "$IMAGE_NAME" bash -s >"$run_log" 2>&1 <<'EOF'; then
set -Eeuo pipefail

source scripts/lib/eve-e2e-instance.sh
eve_e2e_eval_test_state_from_b64 "${EVE_TEST_STATE_SCRIPT_B64:?missing EVE_TEST_STATE_SCRIPT_B64}"
export NPM_CONFIG_PREFIX="$HOME/.npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export OPENAI_API_KEY="sk-eve-npm-onboard-e2e"
export EVE_GATEWAY_TOKEN="npm-onboard-channel-agent-token"

CHANNEL="${EVE_NPM_ONBOARD_CHANNEL:?missing EVE_NPM_ONBOARD_CHANNEL}"
PORT="18789"
MOCK_PORT="44080"
SUCCESS_MARKER="EVE_AGENT_E2E_OK_ASSISTANT"
scenario_tmp="$(mktemp -d "${TMPDIR:-/tmp}/eve-npm-onboard-channel-agent.XXXXXX")"
MOCK_REQUEST_LOG="$scenario_tmp/mock-openai-requests.jsonl"
export SUCCESS_MARKER MOCK_REQUEST_LOG
mock_pid=""

case "$CHANNEL" in
  telegram)
    CHANNEL_TOKEN="123456:eve-npm-onboard-token"
    DEP_SENTINEL="grammy"
    CHANNEL_ADD_ARGS=(--token "$CHANNEL_TOKEN")
    CHANNEL_CONFIG_TOKENS=("$CHANNEL_TOKEN")
    ;;
  discord)
    CHANNEL_TOKEN="eve-npm-onboard-discord-token"
    DEP_SENTINEL="discord-api-types"
    CHANNEL_ADD_ARGS=(--token "$CHANNEL_TOKEN")
    CHANNEL_CONFIG_TOKENS=("$CHANNEL_TOKEN")
    ;;
  slack)
    SLACK_BOT_TOKEN="xoxb-eve-npm-onboard-slack-token"
    SLACK_APP_TOKEN="xapp-eve-npm-onboard-slack-token"
    DEP_SENTINEL="@slack/bolt"
    CHANNEL_ADD_ARGS=(--bot-token "$SLACK_BOT_TOKEN" --app-token "$SLACK_APP_TOKEN")
    CHANNEL_CONFIG_TOKENS=("$SLACK_BOT_TOKEN" "$SLACK_APP_TOKEN")
    ;;
  *)
    echo "unsupported channel: $CHANNEL" >&2
    exit 1
    ;;
esac

cleanup() {
  eve_e2e_stop_process "${mock_pid:-}"
  rm -rf "$scenario_tmp"
}
trap cleanup EXIT

dump_debug_logs() {
  local status="$1"
  echo "npm onboard/channel/agent scenario failed with exit code $status" >&2
  eve_e2e_dump_logs \
    /tmp/eve-install.log \
    /tmp/eve-onboard.json \
    /tmp/eve-channel-add.log \
    /tmp/eve-channels-status.json \
    /tmp/eve-channels-status.err \
    /tmp/eve-status.txt \
    /tmp/eve-status.err \
    /tmp/eve-doctor.log \
    /tmp/eve-agent.combined \
    /tmp/eve-agent.err \
    /tmp/eve-agent.json \
    /tmp/eve-mock-openai.log \
    "$MOCK_REQUEST_LOG" \
    "$EVE_HOME/.eve/eve.json" \
    "$EVE_HOME/.eve/agents/main/agent/auth-profiles.json"
}
trap 'status=$?; dump_debug_logs "$status"; exit "$status"' ERR

eve_e2e_install_package /tmp/eve-install.log

command -v eve >/dev/null
eve_e2e_enable_eve_cli_timeout
package_root="$(eve_e2e_package_root)"
if [ -d "$package_root/dist/extensions/$CHANNEL" ]; then
  CHANNEL_PACKAGE_MODE="bundled"
else
  CHANNEL_PACKAGE_MODE="external"
  echo "$CHANNEL is not packaged with core EVE; expecting channel selection to install it on demand."
fi

mock_pid="$(eve_e2e_start_mock_openai "$MOCK_PORT" /tmp/eve-mock-openai.log)"
eve_e2e_wait_mock_openai "$MOCK_PORT"

echo "Running non-interactive onboarding..."
eve onboard --non-interactive --accept-risk \
  --mode local \
  --auth-choice openai-api-key \
  --secret-input-mode ref \
  --gateway-port "$PORT" \
  --gateway-bind loopback \
  --skip-daemon \
  --skip-ui \
  --skip-skills \
  --skip-health \
  --json >/tmp/eve-onboard.json

node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-onboard-state "$HOME"

eve_e2e_assert_dep_absent "$DEP_SENTINEL" "$HOME/.eve"

echo "Configuring $CHANNEL..."
eve channels add --channel "$CHANNEL" "${CHANNEL_ADD_ARGS[@]}" >/tmp/eve-channel-add.log 2>&1
node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-channel-config "$CHANNEL" "${CHANNEL_CONFIG_TOKENS[@]}"

echo "Checking status surfaces for $CHANNEL..."
eve channels status --json >/tmp/eve-channels-status.json 2>/tmp/eve-channels-status.err
eve status >/tmp/eve-status.txt 2>/tmp/eve-status.err
node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-status-surfaces "$CHANNEL" /tmp/eve-channels-status.json /tmp/eve-status.txt

echo "Running doctor after channel activation..."
eve doctor --repair --non-interactive >/tmp/eve-doctor.log 2>&1
if [ "$CHANNEL_PACKAGE_MODE" = "external" ]; then
  eve_e2e_assert_dep_present "$DEP_SENTINEL" "$HOME/.eve"
else
  eve_e2e_assert_dep_absent "$DEP_SENTINEL" "$HOME/.eve"
fi

node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs configure-mock-model "$MOCK_PORT"
node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-mock-model-config "$MOCK_PORT"

echo "Running local agent turn against mocked OpenAI..."
set +e
eve agent --local \
  --agent main \
  --session-id npm-onboard-channel-agent \
  --message "Return the success marker from the test server." \
  --thinking off \
  --json >/tmp/eve-agent.combined 2>&1
agent_status=$?
set -e
if [ "$agent_status" -ne 0 ]; then
  dump_debug_logs "$agent_status"
  exit "$agent_status"
fi

node scripts/e2e/lib/npm-onboard-channel-agent/assertions.mjs assert-agent-turn "$SUCCESS_MARKER" "$MOCK_REQUEST_LOG"

echo "npm tarball onboard/channel/agent Docker E2E passed for $CHANNEL"
EOF
  docker_e2e_print_log "$run_log"
  exit 1
fi

echo "npm tarball onboard/channel/agent Docker E2E passed ($CHANNEL)"
