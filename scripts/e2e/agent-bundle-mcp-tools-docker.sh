#!/usr/bin/env bash
# Verifies embedded EVE bundle MCP tool materialization and tool-policy behavior
# inside the package-installed functional E2E image.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"
IMAGE_NAME="$(docker_e2e_resolve_image "eve-agent-bundle-mcp-tools-e2e" EVE_IMAGE)"
CONTAINER_NAME="eve-agent-bundle-mcp-tools-e2e-$$"
RUN_LOG="$(mktemp -t eve-agent-bundle-mcp-tools-log.XXXXXX)"

cleanup() {
  docker_e2e_docker_cmd rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -f "$RUN_LOG"
}
trap cleanup EXIT

docker_e2e_build_or_reuse "$IMAGE_NAME" agent-bundle-mcp-tools
EVE_TEST_STATE_SCRIPT_B64="$(docker_e2e_test_state_shell_b64 agent-bundle-mcp-tools empty)"

echo "Running in-container EVE bundle MCP tool availability smoke..."
# Harness files are mounted read-only; the app under test comes from /app/dist.
set +e
docker_e2e_run_with_harness \
  --name "$CONTAINER_NAME" \
  -e "EVE_TEST_STATE_SCRIPT_B64=$EVE_TEST_STATE_SCRIPT_B64" \
  "$IMAGE_NAME" \
  bash -lc "set -euo pipefail
    source scripts/lib/eve-e2e-instance.sh
    eve_e2e_eval_test_state_from_b64 \"\${EVE_TEST_STATE_SCRIPT_B64:?missing EVE_TEST_STATE_SCRIPT_B64}\"
    tsx scripts/e2e/agent-bundle-mcp-tools-docker-client.ts
  " >"$RUN_LOG" 2>&1
status=${PIPESTATUS[0]}
set -e

if [ "$status" -ne 0 ]; then
  echo "Docker EVE bundle MCP tool availability smoke failed"
  cat "$RUN_LOG"
  exit "$status"
fi

cat "$RUN_LOG"
echo "OK"
