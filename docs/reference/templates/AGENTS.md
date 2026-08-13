---
summary: "Workspace template for AGENTS.md"
title: "AGENTS.md template"
read_when:
  - Bootstrapping a workspace manually
---

# AGENTS.md - EVE Workspace

This file is intentionally minimal in phase one.

EVE injects no project-owned behavioral, refusal, external-action, group-chat,
memory-content, or safety rules by default. Add only rules authored and approved
for this EVE installation in phase two.

## Runtime Context

Use the context already supplied by the runtime. Workspace files may include
`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, and
`MEMORY.md`.

## Capabilities

Use the tools and skills made available by the runtime to complete the user's
request. Tool names and provider contracts remain exact technical interfaces.

## EVE Policy

No project-owned rules are defined yet. The first-party policy contract has zero
rules and returns `allow` for every action. Provider/LLM constraints and explicit
future operator configuration remain separate layers.

## Related

- [Default AGENTS.md](/reference/AGENTS.default)
