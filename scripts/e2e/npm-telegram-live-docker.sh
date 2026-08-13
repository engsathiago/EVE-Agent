#!/usr/bin/env bash
# Installs an EVE package candidate in Docker, performs Telegram
# onboarding/doctor recovery, then runs the Telegram QA live harness.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker-e2e-image.sh"

IMAGE_NAME="$(docker_e2e_resolve_image "eve-npm-telegram-live-e2e" EVE_NPM_TELEGRAM_LIVE_E2E_IMAGE)"
DOCKER_TARGET="${EVE_NPM_TELEGRAM_DOCKER_TARGET:-build}"
PACKAGE_SPEC="${EVE_NPM_TELEGRAM_PACKAGE_SPEC:-eve@beta}"
PACKAGE_TGZ="${EVE_NPM_TELEGRAM_PACKAGE_TGZ:-${EVE_CURRENT_PACKAGE_TGZ:-}}"
PACKAGE_LABEL="${EVE_NPM_TELEGRAM_PACKAGE_LABEL:-}"
RUN_ID="${EVE_NPM_TELEGRAM_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
OUTPUT_DIR="${EVE_NPM_TELEGRAM_OUTPUT_DIR:-.artifacts/qa-e2e/npm-telegram-live/$RUN_ID}"
case "$OUTPUT_DIR" in
  /*) OUTPUT_DIR_HOST="$OUTPUT_DIR" ;;
  *) OUTPUT_DIR_HOST="$ROOT_DIR/$OUTPUT_DIR" ;;
esac
OUTPUT_DIR_CONTAINER="/app/.artifacts/qa-e2e/npm-telegram-live-output"

resolve_credential_source() {
  if [ -n "${EVE_NPM_TELEGRAM_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$EVE_NPM_TELEGRAM_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${EVE_QA_CREDENTIAL_SOURCE:-}" ]; then
    printf "%s" "$EVE_QA_CREDENTIAL_SOURCE"
    return 0
  fi
  if [ -n "${CI:-}" ] && [ -n "${EVE_QA_CONVEX_SITE_URL:-}" ]; then
    if [ -n "${EVE_QA_CONVEX_SECRET_CI:-}" ] || [ -n "${EVE_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
      printf "convex"
    fi
  fi
}

resolve_credential_role() {
  if [ -n "${EVE_NPM_TELEGRAM_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$EVE_NPM_TELEGRAM_CREDENTIAL_ROLE"
    return 0
  fi
  if [ -n "${EVE_QA_CREDENTIAL_ROLE:-}" ]; then
    printf "%s" "$EVE_QA_CREDENTIAL_ROLE"
  fi
}

validate_eve_package_spec() {
  local spec="$1"
  if [[ "$spec" =~ ^eve@(alpha|beta|latest|[0-9]{4}\.[1-9][0-9]*\.[1-9][0-9]*(-[1-9][0-9]*|-(alpha|beta)\.[1-9][0-9]*)?)$ ]]; then
    return 0
  fi
  echo "EVE_NPM_TELEGRAM_PACKAGE_SPEC must be eve@alpha, eve@beta, eve@latest, or an exact EVE release version; got: $spec" >&2
  exit 1
}

resolve_package_tgz() {
  local candidate="$1"
  if [ -z "$candidate" ]; then
    return 0
  fi
  if [ ! -f "$candidate" ]; then
    echo "EVE_NPM_TELEGRAM_PACKAGE_TGZ must point to an existing .tgz file; got: $candidate" >&2
    exit 1
  fi
  case "$candidate" in
    *.tgz) ;;
    *)
      echo "EVE_NPM_TELEGRAM_PACKAGE_TGZ must point to a .tgz file; got: $candidate" >&2
      exit 1
      ;;
  esac
  local dir
  local base
  dir="$(cd "$(dirname "$candidate")" && pwd)"
  base="$(basename "$candidate")"
  printf "%s/%s" "$dir" "$base"
}

package_mount_args=()
package_install_source="$PACKAGE_SPEC"
package_source_kind="npm-package"
resolved_package_tgz="$(resolve_package_tgz "$PACKAGE_TGZ")"
if [ -n "$resolved_package_tgz" ]; then
  package_install_source="/package-under-test/$(basename "$resolved_package_tgz")"
  package_source_kind="packed-tarball"
  package_mount_args=(-v "$resolved_package_tgz:$package_install_source:ro")
else
  validate_eve_package_spec "$PACKAGE_SPEC"
fi
if [ -z "$PACKAGE_LABEL" ]; then
  if [ -n "$resolved_package_tgz" ]; then
    PACKAGE_LABEL="$(basename "$resolved_package_tgz")"
  else
    PACKAGE_LABEL="$PACKAGE_SPEC"
  fi
fi

credential_source="$(resolve_credential_source)"
credential_role="$(resolve_credential_role)"
if [ -z "$credential_role" ] && [ "$credential_source" = "convex" ]; then
  if [ -n "${CI:-}" ]; then
    credential_role="ci"
  else
    credential_role="maintainer"
  fi
fi

validate_credential_preflight() {
  if [ "${EVE_NPM_TELEGRAM_SKIP_CREDENTIAL_PREFLIGHT:-0}" = "1" ]; then
    return 0
  fi
  if [ "$credential_source" = "convex" ]; then
    if [ -z "${EVE_QA_CONVEX_SITE_URL:-}" ]; then
      echo "Missing required env for Convex credential mode: EVE_QA_CONVEX_SITE_URL" >&2
      exit 1
    fi
    if [ "$credential_role" = "ci" ]; then
      if [ -z "${EVE_QA_CONVEX_SECRET_CI:-}" ]; then
        echo "Missing required env for Convex ci credential mode: EVE_QA_CONVEX_SECRET_CI" >&2
        exit 1
      fi
      return 0
    fi
    if [ "$credential_role" = "maintainer" ]; then
      if [ -z "${EVE_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
        echo "Missing required env for Convex maintainer credential mode: EVE_QA_CONVEX_SECRET_MAINTAINER" >&2
        exit 1
      fi
      return 0
    fi
    if [ -z "${EVE_QA_CONVEX_SECRET_CI:-}" ] && [ -z "${EVE_QA_CONVEX_SECRET_MAINTAINER:-}" ]; then
      echo "Missing required env for Convex credential mode: EVE_QA_CONVEX_SECRET_CI or EVE_QA_CONVEX_SECRET_MAINTAINER" >&2
      exit 1
    fi
    return 0
  fi

  local missing=()
  for key in \
    EVE_QA_TELEGRAM_GROUP_ID \
    EVE_QA_TELEGRAM_DRIVER_BOT_TOKEN \
    EVE_QA_TELEGRAM_SUT_BOT_TOKEN; do
    if [ -z "${!key:-}" ]; then
      missing+=("$key")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    {
      echo "Missing required Telegram QA credential env before Docker work: ${missing[*]}"
      echo "Use one of:"
      echo "  direct Telegram env: EVE_QA_TELEGRAM_GROUP_ID, EVE_QA_TELEGRAM_DRIVER_BOT_TOKEN, EVE_QA_TELEGRAM_SUT_BOT_TOKEN"
      echo "  Convex env: EVE_NPM_TELEGRAM_CREDENTIAL_SOURCE=convex plus EVE_QA_CONVEX_SITE_URL and a role secret"
    } >&2
    exit 1
  fi
}

validate_credential_preflight

docker_e2e_build_or_reuse "$IMAGE_NAME" npm-telegram-live "$ROOT_DIR/scripts/e2e/Dockerfile" "$ROOT_DIR" "$DOCKER_TARGET"

mkdir -p "$ROOT_DIR/.artifacts/qa-e2e"
mkdir -p "$OUTPUT_DIR_HOST"
run_log="$(mktemp "${TMPDIR:-/tmp}/eve-npm-telegram-live.XXXXXX")"
npm_prefix_host="$(mktemp -d "$ROOT_DIR/.artifacts/qa-e2e/npm-telegram-live-prefix.XXXXXX")"
trap 'rm -f "$run_log"; rm -rf "$npm_prefix_host"' EXIT

docker_env=(
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  -e EVE_E2E_COMMAND_TIMEOUT="${EVE_E2E_COMMAND_TIMEOUT:-300s}"
  -e TMPDIR=/tmp
  -e EVE_NPM_TELEGRAM_PACKAGE_SPEC="$PACKAGE_SPEC"
  -e EVE_NPM_TELEGRAM_PACKAGE_LABEL="$PACKAGE_LABEL"
  -e EVE_NPM_TELEGRAM_OUTPUT_DIR="$OUTPUT_DIR_CONTAINER"
  -e EVE_QA_PACKAGE_SOURCE="$package_install_source"
  -e EVE_QA_PACKAGE_SOURCE_KIND="$package_source_kind"
  -e EVE_QA_RUNNER="${EVE_QA_RUNNER:-docker}"
  -e EVE_NPM_TELEGRAM_FAST="${EVE_NPM_TELEGRAM_FAST:-1}"
)

forward_env_if_set() {
  local key="$1"
  if [ -n "${!key:-}" ]; then
    docker_env+=(-e "$key")
  fi
}

if [ -n "$credential_source" ]; then
  docker_env+=(-e EVE_QA_CREDENTIAL_SOURCE="$credential_source")
fi
if [ -n "$credential_role" ]; then
  docker_env+=(-e EVE_QA_CREDENTIAL_ROLE="$credential_role")
fi

for key in \
  OPENAI_API_KEY \
  ANTHROPIC_API_KEY \
  GEMINI_API_KEY \
  GOOGLE_API_KEY \
  EVE_LIVE_OPENAI_KEY \
  EVE_LIVE_ANTHROPIC_KEY \
  EVE_LIVE_GEMINI_KEY \
  EVE_QA_TELEGRAM_GROUP_ID \
  EVE_QA_TELEGRAM_DRIVER_BOT_TOKEN \
  EVE_QA_TELEGRAM_SUT_BOT_TOKEN \
  EVE_QA_CONVEX_SITE_URL \
  EVE_QA_CONVEX_SECRET_CI \
  EVE_QA_CONVEX_SECRET_MAINTAINER \
  EVE_QA_CREDENTIAL_LEASE_TTL_MS \
  EVE_QA_CREDENTIAL_HEARTBEAT_INTERVAL_MS \
  EVE_QA_CREDENTIAL_ACQUIRE_TIMEOUT_MS \
  EVE_QA_CREDENTIAL_HTTP_TIMEOUT_MS \
  EVE_QA_CONVEX_ENDPOINT_PREFIX \
  EVE_QA_CREDENTIAL_OWNER_ID \
  EVE_QA_ALLOW_INSECURE_HTTP \
  EVE_QA_REDACT_PUBLIC_METADATA \
  EVE_QA_PACKAGE_SOURCE_SHA \
  EVE_QA_TELEGRAM_CANARY_TIMEOUT_MS \
  EVE_QA_TELEGRAM_SCENARIO_TIMEOUT_MS \
  EVE_QA_SUITE_PROGRESS \
  EVE_NPM_TELEGRAM_PROVIDER_MODE \
  EVE_NPM_TELEGRAM_MODEL \
  EVE_NPM_TELEGRAM_ALT_MODEL \
  EVE_NPM_TELEGRAM_SCENARIOS \
  EVE_NPM_TELEGRAM_RTT_SAMPLES \
  EVE_NPM_TELEGRAM_RTT_CHECKS \
  EVE_NPM_TELEGRAM_RTT_TIMEOUT_MS \
  EVE_NPM_TELEGRAM_RTT_MAX_FAILURES \
  EVE_NPM_TELEGRAM_SKIP_HOTPATH \
  EVE_NPM_TELEGRAM_SUT_ACCOUNT \
  EVE_NPM_TELEGRAM_ALLOW_FAILURES; do
  forward_env_if_set "$key"
done

run_logged() {
  if ! "$@" >"$run_log" 2>&1; then
    docker_e2e_print_log "$run_log"
    exit 1
  fi
  docker_e2e_print_log "$run_log"
  >"$run_log"
}

echo "Running package Telegram live Docker E2E ($PACKAGE_LABEL)..."
run_logged docker_e2e_docker_run_cmd run --rm \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e EVE_E2E_NPM_INSTALL_TIMEOUT="${EVE_E2E_NPM_INSTALL_TIMEOUT:-600s}" \
  -e EVE_NPM_TELEGRAM_INSTALL_SOURCE="$package_install_source" \
  -e EVE_NPM_TELEGRAM_PACKAGE_LABEL="$PACKAGE_LABEL" \
  ${package_mount_args[@]+"${package_mount_args[@]}"} \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail

export HOME="$(mktemp -d "/tmp/eve-npm-telegram-install.XXXXXX")"
export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"

install_source="${EVE_NPM_TELEGRAM_INSTALL_SOURCE:?missing EVE_NPM_TELEGRAM_INSTALL_SOURCE}"
package_label="${EVE_NPM_TELEGRAM_PACKAGE_LABEL:-$install_source}"
echo "Installing ${package_label} from ${install_source}..."

npm_install_timeout="${EVE_E2E_NPM_INSTALL_TIMEOUT:-600s}"
run_npm_install() {
  if [ -z "$npm_install_timeout" ] || [ "$npm_install_timeout" = "0" ]; then
    npm install -g "$install_source" --no-fund --no-audit
    return
  fi

  local timeout_bin=""
  if command -v timeout >/dev/null 2>&1; then
    timeout_bin="timeout"
  elif command -v gtimeout >/dev/null 2>&1; then
    timeout_bin="gtimeout"
  fi
  if [ -z "$timeout_bin" ]; then
    echo "timeout or gtimeout is required for EVE_E2E_NPM_INSTALL_TIMEOUT=$npm_install_timeout" >&2
    return 127
  fi

  if "$timeout_bin" --kill-after=1s 1s true >/dev/null 2>&1; then
    "$timeout_bin" --kill-after=30s "$npm_install_timeout" npm install -g "$install_source" --no-fund --no-audit
  else
    "$timeout_bin" "$npm_install_timeout" npm install -g "$install_source" --no-fund --no-audit
  fi
}
run_npm_install

command -v eve
eve --version
EOF

# Mount only QA harness source; the SUT itself, including bundled plugin runtime,
# is the installed package candidate.
run_logged docker_e2e_run_with_harness \
  "${docker_env[@]}" \
  -v "$ROOT_DIR/.artifacts:/app/.artifacts" \
  -v "$OUTPUT_DIR_HOST:$OUTPUT_DIR_CONTAINER" \
  -v "$ROOT_DIR/extensions/qa-lab:/app/extensions/qa-lab:ro" \
  -v "$npm_prefix_host:/npm-global" \
  -i "$IMAGE_NAME" bash -s <<'EOF'
set -euo pipefail
source scripts/lib/eve-e2e-instance.sh

export HOME="$(mktemp -d "/tmp/eve-npm-telegram-runtime.XXXXXX")"
export NPM_CONFIG_PREFIX="/npm-global"
export PATH="$NPM_CONFIG_PREFIX/bin:$PATH"
export EVE_NPM_TELEGRAM_REPO_ROOT="/app"

dump_hotpath_logs() {
  local status="$1"
  echo "installed-package onboarding recovery hot path failed with exit code $status" >&2
  for file in \
    /tmp/eve-npm-telegram-onboard.json \
    /tmp/eve-npm-telegram-channel-add.log \
    /tmp/eve-npm-telegram-doctor-fix.log \
    /tmp/eve-npm-telegram-doctor-check.log; do
    if [ -f "$file" ]; then
      echo "--- $file ---" >&2
      eve_e2e_print_log "$file" >&2
    fi
  done
}
trap 'status=$?; dump_hotpath_logs "$status"; exit "$status"' ERR

command -v eve
eve_e2e_run_command eve --version
mkdir -p /app/node_modules
eve_package_dir="/npm-global/lib/node_modules/eve"
# The mounted QA harness imports eve-agent/plugin-sdk and package dependencies;
# point those imports at the installed package without copying source plugins into the test image.
rm -rf /app/node_modules/eve
ln -sfnT "$eve_package_dir" /app/node_modules/eve
rm -rf /app/dist
ln -sfnT "$eve_package_dir/dist" /app/dist
cp "$eve_package_dir/package.json" /app/package.json
node scripts/e2e/lib/npm-telegram-live/prepare-package.mjs \
  /app/package.json \
  /app/node_modules/eve/package.json
for deps_dir in "$eve_package_dir/node_modules" /npm-global/lib/node_modules; do
  [ -d "$deps_dir" ] || continue
  for dependency_dir in "$deps_dir"/*; do
    [ -e "$dependency_dir" ] || continue
    dependency_name="$(basename "$dependency_dir")"
    case "$dependency_name" in
      .bin | eve)
        continue
        ;;
      @*)
        [ -d "$dependency_dir" ] || continue
        mkdir -p "/app/node_modules/$dependency_name"
        for scoped_dependency_dir in "$dependency_dir"/*; do
          [ -e "$scoped_dependency_dir" ] || continue
          scoped_dependency_name="$(basename "$scoped_dependency_dir")"
          rm -rf "/app/node_modules/$dependency_name/$scoped_dependency_name"
          ln -sfnT "$scoped_dependency_dir" "/app/node_modules/$dependency_name/$scoped_dependency_name"
        done
        ;;
      *)
        rm -rf "/app/node_modules/$dependency_name"
        ln -sfnT "$dependency_dir" "/app/node_modules/$dependency_name"
        ;;
    esac
  done
done

link_installed_package_dependency() {
  local name="$1"
  local source="/npm-global/lib/node_modules/eve/node_modules/$name"
  local target="/app/node_modules/$name"
  if [ ! -e "$source" ]; then
    echo "Installed package dependency is missing: $name" >&2
    return 1
  fi
  mkdir -p "$(dirname "$target")"
  ln -sfn "$source" "$target"
}

# QA Lab is intentionally mounted as harness source, so its package-local
# runtime imports must resolve from the installed package dependency tree.
for dependency in \
  @modelcontextprotocol/sdk \
  yaml \
  zod; do
  link_installed_package_dependency "$dependency"
done

if [ "${EVE_NPM_TELEGRAM_SKIP_HOTPATH:-0}" != "1" ]; then
  echo "Running installed-package onboarding recovery hot path..."
  hotpath_openai_api_key="${OPENAI_API_KEY:-sk-eve-npm-telegram-hotpath}"
  OPENAI_API_KEY="$hotpath_openai_api_key" eve_e2e_run_command eve onboard \
    --non-interactive --accept-risk \
    --mode local \
    --auth-choice openai-api-key \
    --secret-input-mode ref \
    --gateway-port 18789 \
    --gateway-bind loopback \
    --skip-daemon \
    --skip-ui \
    --skip-skills \
    --skip-health \
    --json >/tmp/eve-npm-telegram-onboard.json </dev/null

  eve_e2e_run_command eve channels add --channel telegram --token "123456:eve-npm-telegram-hotpath" >/tmp/eve-npm-telegram-channel-add.log 2>&1 </dev/null
  eve_e2e_run_command eve doctor --fix --non-interactive >/tmp/eve-npm-telegram-doctor-fix.log 2>&1 </dev/null
  eve_e2e_run_command eve doctor --non-interactive >/tmp/eve-npm-telegram-doctor-check.log 2>&1 </dev/null
fi

export EVE_NPM_TELEGRAM_SUT_COMMAND="$(command -v eve)"
trap - ERR
tsx scripts/e2e/npm-telegram-live-runner.ts
EOF

echo "package Telegram live Docker E2E passed ($PACKAGE_LABEL)"
