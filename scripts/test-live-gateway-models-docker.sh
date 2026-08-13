#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="${EVE_LIVE_DOCKER_REPO_ROOT:-$SCRIPT_ROOT_DIR}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
TRUSTED_HARNESS_DIR="${EVE_LIVE_DOCKER_TRUSTED_HARNESS_DIR:-$SCRIPT_ROOT_DIR}"
if [[ -z "$TRUSTED_HARNESS_DIR" || ! -d "$TRUSTED_HARNESS_DIR" ]]; then
  echo "ERROR: trusted live Docker harness directory not found: ${TRUSTED_HARNESS_DIR:-<empty>}." >&2
  exit 1
fi
TRUSTED_HARNESS_DIR="$(cd "$TRUSTED_HARNESS_DIR" && pwd)"
source "$TRUSTED_HARNESS_DIR/scripts/lib/live-docker-auth.sh"
IMAGE_NAME="${EVE_IMAGE:-eve:local}"
LIVE_IMAGE_NAME="${EVE_LIVE_IMAGE:-${IMAGE_NAME}-live}"
CONFIG_DIR="${EVE_CONFIG_DIR:-$HOME/.eve}"
WORKSPACE_DIR="${EVE_WORKSPACE_DIR:-$HOME/.eve/workspace}"
PROFILE_FILE="$(eve_live_default_profile_file)"
DOCKER_USER="${EVE_DOCKER_USER:-node}"
LIVE_GATEWAY_MAX_MODELS="$(eve_live_read_positive_int_env EVE_LIVE_GATEWAY_MAX_MODELS 8)"
LIVE_GATEWAY_STEP_TIMEOUT_MS="$(eve_live_read_positive_int_env EVE_LIVE_GATEWAY_STEP_TIMEOUT_MS 45000)"
LIVE_GATEWAY_MODEL_TIMEOUT_MS="$(eve_live_read_positive_int_env EVE_LIVE_GATEWAY_MODEL_TIMEOUT_MS 90000)"
TEMP_DIRS=()
DOCKER_HOME_MOUNT=()
DOCKER_AUTH_PRESTAGED=0
DOCKER_TRUSTED_HARNESS_CONTAINER_DIR="/trusted-harness"
DOCKER_TRUSTED_HARNESS_MOUNT=(-v "$TRUSTED_HARNESS_DIR":"$DOCKER_TRUSTED_HARNESS_CONTAINER_DIR":ro)
cleanup_temp_dirs() {
  if ((${#TEMP_DIRS[@]} > 0)); then
    rm -rf "${TEMP_DIRS[@]}"
  fi
}
trap cleanup_temp_dirs EXIT
if [[ -n "${EVE_DOCKER_CACHE_HOME_DIR:-}" ]]; then
  CACHE_HOME_DIR="${EVE_DOCKER_CACHE_HOME_DIR}"
elif eve_live_is_ci; then
  CACHE_HOME_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/eve-docker-cache.XXXXXX")"
  TEMP_DIRS+=("$CACHE_HOME_DIR")
else
  CACHE_HOME_DIR="$HOME/.cache/eve/docker-cache"
fi
eve_live_prepare_bind_dir_for_container_user "$CACHE_HOME_DIR"
if eve_live_uses_managed_bind_dirs; then
  DOCKER_USER="$(id -u):$(id -g)"
  DOCKER_HOME_DIR="$(mktemp -d "${RUNNER_TEMP:-/tmp}/eve-docker-home.XXXXXX")"
  TEMP_DIRS+=("$DOCKER_HOME_DIR")
  eve_live_prepare_bind_dir_for_container_user "$DOCKER_HOME_DIR"
  DOCKER_HOME_MOUNT=(-v "$DOCKER_HOME_DIR":/home/node)
fi

PROFILE_MOUNT=()
PROFILE_STATUS="none"
if [[ -f "$PROFILE_FILE" && -r "$PROFILE_FILE" ]]; then
  if [[ -n "${DOCKER_HOME_DIR:-}" ]]; then
    eve_live_stage_profile_into_home "$DOCKER_HOME_DIR" "$PROFILE_FILE"
  else
    PROFILE_MOUNT=(-v "$PROFILE_FILE":/home/node/.profile:ro)
  fi
  PROFILE_STATUS="$PROFILE_FILE"
fi

AUTH_DIRS=()
AUTH_FILES=()
if [[ -n "${EVE_DOCKER_AUTH_DIRS:-}" ]]; then
  while IFS= read -r auth_dir; do
    [[ -n "$auth_dir" ]] || continue
    AUTH_DIRS+=("$auth_dir")
  done < <(eve_live_collect_auth_dirs)
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(eve_live_collect_auth_files)
elif [[ -n "${EVE_LIVE_GATEWAY_PROVIDERS:-}" ]]; then
  while IFS= read -r auth_dir; do
    [[ -n "$auth_dir" ]] || continue
    AUTH_DIRS+=("$auth_dir")
  done < <(eve_live_collect_auth_dirs_from_csv "${EVE_LIVE_GATEWAY_PROVIDERS:-}")
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(eve_live_collect_auth_files_from_csv "${EVE_LIVE_GATEWAY_PROVIDERS:-}")
else
  while IFS= read -r auth_dir; do
    [[ -n "$auth_dir" ]] || continue
    AUTH_DIRS+=("$auth_dir")
  done < <(eve_live_collect_auth_dirs)
  while IFS= read -r auth_file; do
    [[ -n "$auth_file" ]] || continue
    AUTH_FILES+=("$auth_file")
  done < <(eve_live_collect_auth_files)
fi
AUTH_DIRS_CSV=""
if ((${#AUTH_DIRS[@]} > 0)); then
  AUTH_DIRS_CSV="$(eve_live_join_csv "${AUTH_DIRS[@]}")"
fi
AUTH_FILES_CSV=""
if ((${#AUTH_FILES[@]} > 0)); then
  AUTH_FILES_CSV="$(eve_live_join_csv "${AUTH_FILES[@]}")"
fi

if [[ -n "${DOCKER_HOME_DIR:-}" ]]; then
  eve_live_stage_auth_into_home "$DOCKER_HOME_DIR" "${AUTH_DIRS[@]}" --files "${AUTH_FILES[@]}"
  DOCKER_AUTH_PRESTAGED=1
fi
CONTAINER_NODE_OPTIONS="$(eve_live_container_node_options)"

EXTERNAL_AUTH_MOUNTS=()
if ((${#AUTH_DIRS[@]} > 0)); then
  for auth_dir in "${AUTH_DIRS[@]}"; do
    auth_dir="$(eve_live_validate_relative_home_path "$auth_dir")"
    host_path="$HOME/$auth_dir"
    if [[ -d "$host_path" ]]; then
      EXTERNAL_AUTH_MOUNTS+=(-v "$host_path":/host-auth/"$auth_dir":ro)
    fi
  done
fi
if ((${#AUTH_FILES[@]} > 0)); then
  for auth_file in "${AUTH_FILES[@]}"; do
    auth_file="$(eve_live_validate_relative_home_path "$auth_file")"
    host_path="$HOME/$auth_file"
    if [[ -f "$host_path" ]]; then
      EXTERNAL_AUTH_MOUNTS+=(-v "$host_path":/host-auth-files/"$auth_file":ro)
    fi
  done
fi

read -r -d '' LIVE_TEST_CMD <<'EOF' || true
set -euo pipefail
[ -f "$HOME/.profile" ] && [ -r "$HOME/.profile" ] && source "$HOME/.profile" || true
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export COREPACK_HOME="${COREPACK_HOME:-$XDG_CACHE_HOME/node/corepack}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-$XDG_CACHE_HOME/npm}"
export npm_config_cache="$NPM_CONFIG_CACHE"
mkdir -p "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE"
chmod 700 "$XDG_CACHE_HOME" "$COREPACK_HOME" "$NPM_CONFIG_CACHE" || true
if [ "${EVE_DOCKER_AUTH_PRESTAGED:-0}" != "1" ]; then
  IFS=',' read -r -a auth_dirs <<<"${EVE_DOCKER_AUTH_DIRS_RESOLVED:-}"
  IFS=',' read -r -a auth_files <<<"${EVE_DOCKER_AUTH_FILES_RESOLVED:-}"
  if ((${#auth_dirs[@]} > 0)); then
    for auth_dir in "${auth_dirs[@]}"; do
      [ -n "$auth_dir" ] || continue
      if [ -d "/host-auth/$auth_dir" ]; then
        mkdir -p "$HOME/$auth_dir"
        cp -R "/host-auth/$auth_dir/." "$HOME/$auth_dir"
        chmod -R u+rwX "$HOME/$auth_dir" || true
      fi
    done
  fi
  if ((${#auth_files[@]} > 0)); then
    for auth_file in "${auth_files[@]}"; do
      [ -n "$auth_file" ] || continue
      if [ -f "/host-auth-files/$auth_file" ]; then
        mkdir -p "$(dirname "$HOME/$auth_file")"
        cp "/host-auth-files/$auth_file" "$HOME/$auth_file"
        chmod u+rw "$HOME/$auth_file" || true
      fi
    done
  fi
fi
tmp_dir="$(mktemp -d)"
trusted_scripts_dir="${EVE_LIVE_DOCKER_SCRIPTS_DIR:-/src/scripts}"
source "$trusted_scripts_dir/lib/live-docker-stage.sh"
eve_live_stage_source_tree "$tmp_dir"
eve_live_stage_node_modules "$tmp_dir"
eve_live_link_runtime_tree "$tmp_dir"
eve_live_stage_state_dir "$tmp_dir/.eve-state"
eve_live_prepare_staged_config
cd "$tmp_dir"
node scripts/test-live.mjs -- src/gateway/gateway-models.profiles.live.test.ts
EOF

EVE_LIVE_DOCKER_REPO_ROOT="$ROOT_DIR" "$TRUSTED_HARNESS_DIR/scripts/test-live-build-docker.sh"
if eve_live_uses_managed_bind_dirs; then
  eve_live_chown_bind_dirs_for_container_user \
    "$LIVE_IMAGE_NAME" \
    "$DOCKER_USER" \
    "$CACHE_HOME_DIR" \
    "${DOCKER_HOME_DIR:-}"
fi

echo "==> Run gateway live model tests (profile keys)"
echo "==> Target: src/gateway/gateway-models.profiles.live.test.ts"
echo "==> Profile file: $PROFILE_STATUS"
echo "==> External auth dirs: ${AUTH_DIRS_CSV:-none}"
echo "==> External auth files: ${AUTH_FILES_CSV:-none}"
DOCKER_RUN_ARGS=()
eve_live_init_docker_run_args DOCKER_RUN_ARGS "${EVE_LIVE_GATEWAY_DOCKER_RUN_TIMEOUT:-2100s}"
DOCKER_RUN_ARGS+=(--rm -t \
  -u "$DOCKER_USER" \
  --entrypoint bash \
  -e OPENAI_API_KEY \
  -e OPENAI_BASE_URL \
  -e ANTHROPIC_API_KEY \
  -e GEMINI_API_KEY \
  -e GOOGLE_API_KEY \
  -e MINIMAX_API_KEY \
  -e OPENROUTER_API_KEY \
  -e FIREWORKS_API_KEY \
  -e DEEPSEEK_API_KEY \
  -e XAI_API_KEY \
  -e ZAI_API_KEY \
  -e Z_AI_API_KEY \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e HOME=/home/node \
  -e NODE_OPTIONS="$CONTAINER_NODE_OPTIONS" \
  -e EVE_SKIP_CHANNELS=1 \
  -e EVE_SUPPRESS_NOTES=1 \
  -e EVE_DOCKER_AUTH_PRESTAGED="$DOCKER_AUTH_PRESTAGED" \
  -e EVE_DOCKER_AUTH_DIRS_RESOLVED="$AUTH_DIRS_CSV" \
  -e EVE_DOCKER_AUTH_FILES_RESOLVED="$AUTH_FILES_CSV" \
  -e EVE_LIVE_DOCKER_SCRIPTS_DIR="${DOCKER_TRUSTED_HARNESS_CONTAINER_DIR}/scripts" \
  -e EVE_LIVE_DOCKER_SOURCE_STAGE_MODE="${EVE_LIVE_DOCKER_SOURCE_STAGE_MODE:-copy}" \
  -e EVE_LIVE_TEST=1 \
  -e EVE_LIVE_TEST_QUIET="${EVE_LIVE_TEST_QUIET:-}" \
  -e EVE_LIVE_WRAPPER_HEARTBEAT_MS="${EVE_LIVE_WRAPPER_HEARTBEAT_MS:-}" \
  -e EVE_LIVE_REQUIRE_PROFILE_KEYS="${EVE_LIVE_REQUIRE_PROFILE_KEYS:-}" \
  -e EVE_LIVE_GATEWAY_MODELS="${EVE_LIVE_GATEWAY_MODELS:-modern}" \
  -e EVE_LIVE_GATEWAY_PROVIDERS="${EVE_LIVE_GATEWAY_PROVIDERS:-}" \
  -e EVE_LIVE_GATEWAY_THINKING="${EVE_LIVE_GATEWAY_THINKING:-}" \
  -e EVE_LIVE_GATEWAY_SMOKE="${EVE_LIVE_GATEWAY_SMOKE:-1}" \
  -e EVE_LIVE_GATEWAY_MAX_MODELS="$LIVE_GATEWAY_MAX_MODELS" \
  -e EVE_LIVE_GATEWAY_HEARTBEAT_MS="${EVE_LIVE_GATEWAY_HEARTBEAT_MS:-}" \
  -e EVE_LIVE_GATEWAY_STEP_TIMEOUT_MS="$LIVE_GATEWAY_STEP_TIMEOUT_MS" \
  -e EVE_LIVE_GATEWAY_MODEL_TIMEOUT_MS="$LIVE_GATEWAY_MODEL_TIMEOUT_MS" \
  -e EVE_VITEST_FS_MODULE_CACHE=0)
eve_live_append_array DOCKER_RUN_ARGS DOCKER_HOME_MOUNT
eve_live_append_array DOCKER_RUN_ARGS DOCKER_TRUSTED_HARNESS_MOUNT
DOCKER_RUN_ARGS+=(\
  -v "$CACHE_HOME_DIR":/home/node/.cache \
  -v "$ROOT_DIR":/src:ro \
  -v "$CONFIG_DIR":/home/node/.eve \
  -v "$WORKSPACE_DIR":/home/node/.eve/workspace)
eve_live_append_array DOCKER_RUN_ARGS EXTERNAL_AUTH_MOUNTS
eve_live_append_array DOCKER_RUN_ARGS PROFILE_MOUNT
DOCKER_RUN_ARGS+=(\
  "$LIVE_IMAGE_NAME" \
  -lc "$LIVE_TEST_CMD")
"${DOCKER_RUN_ARGS[@]}"
