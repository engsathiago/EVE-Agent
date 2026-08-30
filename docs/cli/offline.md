---
summary: "CLI reference for local Ollama readiness and checksummed offline EVE installation bundles"
read_when:
  - You want to run EVE with a local Ollama model
  - You need to install EVE on a machine without network access
  - You are verifying an offline bundle before installation
title: "Offline operation"
sidebarTitle: "Offline"
---

`eve offline` configures local Ollama models and builds portable EVE bundles
that install without reaching the network.

## Check local readiness

Start Ollama and download a tool-capable model, then run:

```bash
eve offline status
eve offline status --json
```

Use a non-default Ollama endpoint with `--base-url <url>`.

## Configure a local model

```bash
eve offline configure --model qwen3:8b
```

EVE verifies that the model is visible through Ollama before writing config.
Use `--allow-missing` only when the model will be installed later:

```bash
eve offline configure --model qwen3:8b --allow-missing
```

The command configures the Ollama provider and makes `ollama/qwen3:8b` the
default model. It does not require an external API key.

## Build an offline bundle

Run this on the same operating system and CPU architecture as the offline
machine:

```bash
eve offline bundle --output /Volumes/USB/eve-offline
```

The output directory must be empty and outside the EVE source tree. The bundle
contains:

- an `eve-agent` package archive;
- a complete warmed npm dependency cache;
- `install-offline.sh`;
- the exact SHA-256 verifier;
- `offline-manifest.json` with platform, Node version, package, and checksums.

Optionally include Ollama assets:

```bash
eve offline bundle \
  --output /Volumes/USB/eve-full \
  --include-models \
  --include-ollama \
  --ollama-binary /usr/local/bin/ollama
```

Models can consume many gigabytes. The Ollama executable and model store must
match the target platform and required native libraries.

## Install without a network

Copy the directory to the isolated machine. Transfer the printed manifest SHA-256
through a trusted channel separate from the bundle, then run:

```bash
cd eve-offline
EVE_OFFLINE_MANIFEST_SHA256='<trusted manifest SHA-256>' ./install-offline.sh
~/.local/bin/eve --version
```

The installer first verifies that trusted manifest digest, then validates every manifest entry before installation, rejects
missing or unexpected files, and installs from the bundled npm cache with
offline mode enabled.

## Troubleshooting

| Symptom                         | Check                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `Ollama model is not available` | Run `ollama list`, start Ollama, or use `--allow-missing` only for planned installation. |
| Output directory is not empty   | Select a new empty directory outside the checkout.                                       |
| Manifest verification fails     | Rebuild the bundle; do not edit or partially copy its contents.                          |
| Native module fails on target   | Rebuild on the same OS, architecture, and libc family as the target.                     |
| Models are missing              | Rebuild with `--include-models` or transfer the Ollama model store separately.           |

## Related

- [EVE platform](/concepts/eve-platform)
- [Linux server](/vps)
- [Ollama provider](/providers/ollama)
- [Backup CLI](/cli/backup)
