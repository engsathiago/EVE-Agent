# @eve/tokenjuice

Official Tokenjuice output compaction plugin for EVE.

Tokenjuice compacts noisy `exec` and `bash` tool results after commands run, before the result is fed back into the active agent session. It does not rewrite commands, rerun commands, or change exit codes.

## Install

```bash
eve plugins install @eve/tokenjuice
```

Restart the Gateway after installing or updating the plugin.

## Enable

```bash
eve config set plugins.entries.tokenjuice.enabled true
```

Equivalent:

```bash
eve plugins enable tokenjuice
```

## Docs

- https://docs.eve.ai/tools/tokenjuice

## Package

- Plugin id: `tokenjuice`
- Package: `@eve/tokenjuice`
- Minimum EVE host: `2026.5.28`
