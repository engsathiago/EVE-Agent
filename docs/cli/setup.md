---
summary: "CLI reference for `eve setup` (initialize config plus workspace, optionally run onboarding)"
read_when:
  - You're doing first-run setup without full CLI onboarding
  - You want to set the default workspace path
  - You need every flag and how setup decides between baseline and wizard mode
title: "Setup"
---

# `eve setup`

Initialize the baseline config and agent workspace. With any onboarding flag present, also runs the wizard.

<Note>
`eve setup` is for mutable config installs. In Nix mode (`EVE_NIX_MODE=1`) EVE refuses setup writes because the config file is managed by Nix. Use the first-party [nix-eve Quick Start](https://github.com/eve/nix-eve#quick-start) or the equivalent source config for another Nix package.
</Note>

## Options

| Flag                       | Description                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `--workspace <dir>`        | Agent workspace directory (default `~/.eve/workspace`; stored as `agents.defaults.workspace`). |
| `--wizard`                 | Run interactive onboarding.                                                                         |
| `--non-interactive`        | Run onboarding without prompts.                                                                     |
| `--accept-risk`            | Acknowledge full-system agent access risk; required with `--non-interactive`.                       |
| `--mode <mode>`            | Onboarding mode: `local` or `remote`.                                                               |
| `--import-from <provider>` | Migration provider to run during onboarding.                                                        |
| `--import-source <path>`   | Source agent home for `--import-from`.                                                              |
| `--import-secrets`         | Import supported secrets during onboarding migration.                                               |
| `--remote-url <url>`       | Remote Gateway WebSocket URL.                                                                       |
| `--remote-token <token>`   | Remote Gateway token (optional).                                                                    |

### Wizard auto-trigger

`eve setup` runs the wizard when any of these flags are explicitly present, even without `--wizard`:

`--wizard`, `--non-interactive`, `--accept-risk`, `--mode`, `--import-from`, `--import-source`, `--import-secrets`, `--remote-url`, `--remote-token`.

## Examples

```bash
eve setup
eve setup --workspace ~/.eve/workspace
eve setup --wizard
eve setup --wizard --import-from hermes --import-source ~/.hermes
eve setup --non-interactive --accept-risk --mode remote --remote-url wss://gateway-host:18789 --remote-token <token>
```

## Notes

- Plain `eve setup` initializes config and workspace without running the full onboarding flow.
- After plain setup, run `eve onboard` for the full guided journey, `eve configure` for targeted changes, or `eve channels add` to add channel accounts.
- If Hermes state is detected, interactive onboarding can offer migration automatically. Import onboarding requires a fresh setup; use [Migrate](/cli/migrate) for dry-run plans, backups, and overwrite mode outside onboarding.

## Related

- [CLI reference](/cli)
- [Onboarding (CLI)](/start/wizard)
- [Getting started](/start/getting-started)
- [Install overview](/install)
