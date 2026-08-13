# @eve/acpx

Official ACP runtime backend for EVE.

ACPx lets EVE run external coding harnesses through the Agent Client Protocol while EVE still owns sessions, channels, delivery, permissions, and Gateway state.

## Install

```bash
eve plugins install @eve/acpx
```

Restart the Gateway after installing or updating the plugin.

## What it provides

- ACP-backed agent runtime sessions.
- Plugin-owned session and transport management.
- MCP bridge helpers for EVE tools and plugin tools.
- Static runtime assets used by the ACP process bridge.

## Configure

Use the ACP docs for harness-specific setup, permission modes, and model/runtime selection:

- https://docs.eve.ai/tools/acp-agents-setup
- https://docs.eve.ai/tools/acp-agents

## Package

- Plugin id: `acpx`
- Package: `@eve/acpx`
- Minimum EVE host: `2026.4.25`
