#!/usr/bin/env bash
# Install a verified EVE bundle without network access.
set -euo pipefail

bundle_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install_dir="${EVE_OFFLINE_INSTALL_DIR:-$HOME/.local/share/eve}"
bin_dir="${EVE_OFFLINE_BIN_DIR:-$HOME/.local/bin}"
run_onboard=0
force=0

usage() {
  cat <<'EOF'
Usage: ./install-offline.sh [options]

Options:
  --install-dir <path>  Installation root (default: ~/.local/share/eve)
  --bin-dir <path>      Command directory (default: ~/.local/bin)
  --onboard             Run `eve onboard` after installation
  --force               Replace an existing installation (keeps a timestamped backup)
  -h, --help            Show this help
EOF
}

while (($#)); do
  case "$1" in
    --install-dir)
      [[ $# -ge 2 ]] || { echo "missing value for --install-dir" >&2; exit 2; }
      install_dir="$2"
      shift 2
      ;;
    --bin-dir)
      [[ $# -ge 2 ]] || { echo "missing value for --bin-dir" >&2; exit 2; }
      bin_dir="$2"
      shift 2
      ;;
    --onboard)
      run_onboard=1
      shift
      ;;
    --force)
      force=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

command -v node >/dev/null 2>&1 || { echo "Node.js is required (>=22.19)." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required." >&2; exit 1; }

node -e '
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 19)) {
  console.error(`EVE requires Node.js >=22.19 (found ${process.versions.node}).`);
  process.exit(1);
}'
: "${EVE_OFFLINE_MANIFEST_SHA256:?Set EVE_OFFLINE_MANIFEST_SHA256 from a trusted release channel before installing.}"
node "$bundle_dir/verify-offline-manifest.mjs" "$bundle_dir" "$EVE_OFFLINE_MANIFEST_SHA256"

node -e '
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const target = `${process.platform}-${process.arch}`;
if (manifest.platform !== target) {
  console.error(`Offline bundle targets ${manifest.platform}; this host is ${target}.`);
  process.exit(1);
}
' "$bundle_dir/offline-manifest.json"

package_file="$(node -e '
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (typeof manifest.package !== "string" || !manifest.package.endsWith(".tgz")) process.exit(2);
process.stdout.write(manifest.package);
' "$bundle_dir/offline-manifest.json")"

if [[ -e "$install_dir" && "$force" -ne 1 ]]; then
  echo "Installation already exists: $install_dir (use --force to replace it)." >&2
  exit 1
fi

install_parent="$(dirname "$install_dir")"
mkdir -p "$install_parent" "$bin_dir"
stage_dir="$(mktemp -d "$install_parent/.eve-offline.XXXXXX")"
cleanup() {
  if [[ -n "$stage_dir" && -d "$stage_dir" ]]; then
    rm -rf "$stage_dir"
  fi
}
trap cleanup EXIT

npm install \
  --offline \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  --cache "$bundle_dir/npm-cache" \
  --prefix "$stage_dir/app" \
  "$bundle_dir/$package_file"

# npm lifecycle scripts stay disabled for the dependency tree above. Run only
# EVE's audited package postinstall against the final staged installation so
# bundled-plugin compatibility fixes are not lost with the warm cache.
eve_package_root="$stage_dir/app/node_modules/eve-agent"
eve_postinstall="$eve_package_root/scripts/postinstall-bundled-plugins.mjs"
if [[ ! -f "$eve_postinstall" ]]; then
  echo "EVE package postinstall is missing: $eve_postinstall" >&2
  exit 1
fi
(
  cd "$eve_package_root"
  node "$eve_postinstall"
)

if [[ -x "$bundle_dir/bin/ollama" ]]; then
  mkdir -p "$stage_dir/bin"
  cp "$bundle_dir/bin/ollama" "$stage_dir/bin/ollama"
  chmod 0755 "$stage_dir/bin/ollama"
fi

if [[ -e "$install_dir" ]]; then
  backup_dir="${install_dir}.previous.$(date +%Y%m%d%H%M%S)"
  mv "$install_dir" "$backup_dir"
  echo "Previous installation preserved at $backup_dir"
fi
mv "$stage_dir" "$install_dir"
stage_dir=""
ln -sfn "$install_dir/app/node_modules/.bin/eve" "$bin_dir/eve"

if [[ -x "$install_dir/bin/ollama" ]]; then
  ln -sfn "$install_dir/bin/ollama" "$bin_dir/ollama"
fi
if [[ -d "$bundle_dir/ollama-models" ]]; then
  mkdir -p "$HOME/.ollama/models"
  cp -R "$bundle_dir/ollama-models/." "$HOME/.ollama/models/"
fi

echo "EVE installed offline at $install_dir"
echo "Command: $bin_dir/eve"
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) echo "Add $bin_dir to PATH to invoke eve directly." ;;
esac

if [[ "$run_onboard" -eq 1 ]]; then
  "$bin_dir/eve" onboard
fi
