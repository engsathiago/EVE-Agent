---
summary: "Uninstall EVE completely (CLI, service, state, workspace)"
read_when:
  - You want to remove EVE from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

Two paths:

- **Easy path** if `eve` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
eve uninstall
```

When using the CLI, state removal preserves configured workspace directories unless you also select `--workspace`.

Preview what will be removed (safe):

```bash
eve uninstall --dry-run --all
```

Non-interactive (automation / npx). Use with caution and only after confirming scopes:

```bash
eve uninstall --all --yes --non-interactive
npx -y eve uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
eve gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
eve gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${EVE_STATE_DIR:-$HOME/.eve}"
```

If you set `EVE_CONFIG_PATH` to a custom location outside the state dir, delete that file too.
If you want to keep a workspace inside the state dir, such as `~/.eve/workspace`, move it aside before running `rm -rf` or delete state contents selectively.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.eve/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g eve
pnpm remove -g eve
bun remove -g eve
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/EVE.app
```

Notes:

- If you used profiles (`--profile` / `EVE_PROFILE`), repeat step 3 for each state dir (defaults are `~/.eve-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `eve` is missing.

### macOS (launchd)

Default label is `ai.eve.gateway` (or `ai.eve.<profile>`; legacy `com.eve.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.eve.gateway
rm -f ~/Library/LaunchAgents/ai.eve.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.eve.<profile>`. Remove any legacy `com.eve.*` plists if present.

### Linux (systemd user unit)

Default unit name is `eve-gateway.service` (or `eve-gateway-<profile>.service`):

```bash
systemctl --user disable --now eve-gateway.service
rm -f ~/.config/systemd/user/eve-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `EVE Gateway` (or `EVE Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "EVE Gateway"
Remove-Item -Force "$env:USERPROFILE\.eve\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.eve-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://eve.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g eve-agent@latest`.
Remove it with `npm rm -g eve` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `eve ...` / `bun run eve ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.

## Related

- [Install overview](/install)
- [Migration guide](/install/migrating)
