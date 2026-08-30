#!/usr/bin/env bash
# Provision EVE on a Linux VPS from npm, GitHub, or an existing source checkout.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || pwd)"
prefix="${EVE_PREFIX:-$HOME/.eve}"
version="${EVE_VERSION:-latest}"
source_dir=""
restore_archive=""
workspace=""
gateway_bind="loopback"
gateway_custom_host=""
gateway_port="18789"
interactive=0
skip_onboard=0
install_daemon=1
dry_run=0

usage() {
  cat <<'EOF'
Usage: install-vps.sh [options]

Installs EVE, configures a local Gateway, installs the user service, and checks it.

Options:
  --prefix <path>          EVE tool prefix (default: ~/.eve)
  --version <version>      npm version/tag or git ref (default: latest)
  --source-dir <path>      Build and install an existing EVE git checkout
  --restore <archive>      Restore a verified EVE backup before service startup
  --workspace <path>       Workspace for onboarding or relocated backup restore
  --gateway-bind <mode>    loopback|tailnet|lan|auto|custom (default: loopback)
  --gateway-custom-host <host>
                           Required IPv4 address when --gateway-bind custom
  --gateway-port <port>    Gateway port (default: 18789)
  --interactive            Run the guided onboarding flow
  --non-interactive        Configure a provider-neutral local Gateway (default)
  --skip-onboard           Install only; do not configure or start the Gateway
  --no-install-daemon      Configure without installing the user service
  --dry-run                Print commands without executing them
  -h, --help               Show this help

Environment:
  EVE_INSTALL_CLI_URL      Override the install-cli.sh download URL
  EVE_PREFIX              Default --prefix value
  EVE_VERSION             Default --version value
EOF
}

fail() {
  echo "EVE VPS install failed: $*" >&2
  exit 1
}

quote_command() {
  printf '%q ' "$@"
  printf '\n'
}

run() {
  if [[ "$dry_run" -eq 1 ]]; then
    quote_command "$@"
  else
    "$@"
  fi
}

require_value() {
  [[ $# -ge 2 && -n "${2:-}" && "${2:-}" != --* ]] || fail "missing value for $1"
}

while (($#)); do
  case "$1" in
    --prefix)
      require_value "$@"; prefix="$2"; shift 2 ;;
    --version)
      require_value "$@"; version="$2"; shift 2 ;;
    --source-dir)
      require_value "$@"; source_dir="$2"; shift 2 ;;
    --restore)
      require_value "$@"; restore_archive="$2"; shift 2 ;;
    --workspace)
      require_value "$@"; workspace="$2"; shift 2 ;;
    --gateway-bind)
      require_value "$@"; gateway_bind="$2"; shift 2 ;;
    --gateway-custom-host)
      require_value "$@"; gateway_custom_host="$2"; shift 2 ;;
    --gateway-port)
      require_value "$@"; gateway_port="$2"; shift 2 ;;
    --interactive)
      interactive=1; shift ;;
    --non-interactive)
      interactive=0; shift ;;
    --skip-onboard)
      skip_onboard=1; shift ;;
    --no-install-daemon)
      install_daemon=0; shift ;;
    --dry-run)
      dry_run=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      fail "unknown option: $1" ;;
  esac
done

[[ "$gateway_port" =~ ^[0-9]+$ ]] || fail "gateway port must be numeric"
gateway_port_number=$((10#$gateway_port))
((gateway_port_number >= 1 && gateway_port_number <= 65535)) || fail "gateway port must be 1-65535"
case "$gateway_bind" in
  loopback|tailnet|lan|auto|custom) ;;
  *) fail "unsupported gateway bind mode: $gateway_bind" ;;
esac
if [[ "$gateway_bind" == "custom" && -z "$gateway_custom_host" ]]; then
  fail "--gateway-custom-host is required when --gateway-bind custom"
fi
if [[ "$gateway_bind" != "custom" && -n "$gateway_custom_host" ]]; then
  fail "--gateway-custom-host requires --gateway-bind custom"
fi

if [[ -n "$source_dir" ]]; then
  source_dir="$(cd "$source_dir" 2>/dev/null && pwd)" || fail "source directory not found"
  [[ -f "$source_dir/package.json" ]] || fail "source directory is not an EVE checkout"
fi
if [[ -n "$restore_archive" && "$dry_run" -ne 1 ]]; then
  restore_archive="$(cd "$(dirname "$restore_archive")" 2>/dev/null && pwd)/$(basename "$restore_archive")"
  [[ -f "$restore_archive" ]] || fail "backup archive not found"
fi

installer_args=(--prefix "$prefix" --no-onboard)
if [[ -n "$source_dir" ]]; then
  installer_args+=(--git --git-dir "$source_dir" --no-git-update)
else
  installer_args+=(--npm --version "$version")
fi

installer="${EVE_INSTALL_CLI_PATH:-$script_dir/install-cli.sh}"
temporary_installer=""
cleanup() {
  if [[ -n "$temporary_installer" ]]; then
    rm -f "$temporary_installer"
  fi
}
trap cleanup EXIT

if [[ ! -f "$installer" ]]; then
  command -v curl >/dev/null 2>&1 || fail "curl is required to download install-cli.sh"
  temporary_installer="$(mktemp)"
  installer="$temporary_installer"
  installer_url="${EVE_INSTALL_CLI_URL:-https://eve.ai/install-cli.sh}"
  run curl -fsSL --proto '=https' --tlsv1.2 --retry 3 -o "$installer" "$installer_url"
fi

echo "Installing EVE into $prefix"
run bash "$installer" "${installer_args[@]}"

eve_bin="${EVE_VPS_EVE_BIN:-$prefix/bin/eve}"
if [[ "$dry_run" -ne 1 ]]; then
  [[ -x "$eve_bin" ]] || fail "installer did not create $eve_bin"
fi
if [[ "$skip_onboard" -eq 1 ]]; then
  echo "EVE installed; onboarding was skipped."
  exit 0
fi

if [[ -n "$restore_archive" ]]; then
  restore_args=(backup restore "$restore_archive" --apply)
  [[ -n "$workspace" ]] && restore_args+=(--workspace-root "$workspace")
  run "$eve_bin" "${restore_args[@]}"
  run "$eve_bin" doctor --repair --non-interactive
  if [[ "$install_daemon" -eq 1 ]]; then
    run "$eve_bin" gateway install --force
    run "$eve_bin" gateway restart
  fi
else
  onboard_args=(onboard --flow quickstart --mode local --gateway-port "$gateway_port" --gateway-bind "$gateway_bind")
  [[ -n "$gateway_custom_host" ]] && onboard_args+=(--gateway-custom-bind-host "$gateway_custom_host")
  [[ -n "$workspace" ]] && onboard_args+=(--workspace "$workspace")
  if [[ "$install_daemon" -eq 1 ]]; then
    onboard_args+=(--install-daemon)
  else
    onboard_args+=(--skip-daemon)
  fi
  if [[ "$interactive" -eq 0 ]]; then
    onboard_args+=(--non-interactive --accept-risk --auth-choice skip --skip-channels --skip-skills --skip-ui)
  fi
  run "$eve_bin" "${onboard_args[@]}"
fi

run "$eve_bin" doctor --non-interactive
if [[ "$install_daemon" -eq 1 ]]; then
  run "$eve_bin" gateway status --probe
fi
echo "EVE VPS installation is complete."
