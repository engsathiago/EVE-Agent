---
summary: "How EVE combines the complete agent runtime with projects, missions, intelligence, Studio, environments, recovery, and offline operation"
read_when:
  - You want the complete EVE capability map
  - You are comparing EVE with the Athena 0.4 feature set
  - You need to choose between Mission Control, flows, workers, environments, or Studio
title: "EVE platform"
sidebarTitle: "EVE platform"
---

EVE is an independent agent platform with one runtime for model providers,
channels, tools, plugins, applications, sessions, nodes, automation, and
operational intelligence. Product features are native EVE plugins and share the
same Gateway, authentication, state, tools, and Control UI.

## Start the platform

Install and onboard EVE, then open the Control UI:

```bash
npm install -g eve-agent@latest
eve onboard --install-daemon
eve dashboard
```

Verify the operational services:

```bash
eve gateway status --probe
eve intelligence status
eve mission status
```

The Control UI exposes Projects, Environments, Studio, Integrations,
Intelligence, and Workboard. The same data is available through CLI commands,
Gateway RPC, and agent tools.

## Capability map

| Area              | What EVE owns                                                                                  | Main interfaces                              |
| ----------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Agent runtime     | Providers, streaming, tool calls, context, sessions, compaction, retries, and model fallback   | `eve agent`, chat, Gateway                   |
| Channels          | Message routing, accounts, pairing, groups, attachments, and delivery                          | `eve channels`, channel plugins              |
| Tools and plugins | Browser, files, shell, media, MCP, skills, plugins, and remote nodes                           | agent tools, `eve plugins`, `eve mcp`        |
| Agents and goals  | Isolated workspaces, identities, bindings, subagents, session goals, and memory                | `eve agents`, goal tools, memory tools       |
| Mission Control   | Boards, missions, instructions, pause, resume, retry, reassignment, proof, and worker dispatch | Workboard UI, `eve mission`, `eve workboard` |
| Projects          | Named multi-folder workspaces linked to Mission Control boards                                 | Projects UI, `eve projects`                  |
| Intelligence      | Traces, Result Hub, evals, flows, routing, experiments, Model Lab, and workers                 | Intelligence UI and CLI                      |
| Environments      | Docker computers with CPU, memory, TTL, persistence, network control, and snapshots            | Environments UI, `eve environments`          |
| Studio            | Versioned artifacts, imports, editing, preview, download, and publication                      | Studio UI, `eve studio`                      |
| Integrations      | Unified catalog of MCP servers, plugins, and channels                                          | Integrations UI, `eve integrations`          |
| Recovery          | Backups, verified dry-run restore, pre-restore backup, and path relocation                     | `eve backup`                                 |
| Offline operation | Ollama configuration and checksummed network-free installation bundles                         | `eve offline`                                |

## Athena improvement parity

The Athena 0.3 and 0.4 improvements are implemented as EVE-native services,
not as a second runtime or a Python sidecar.

| Athena capability                | EVE implementation                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Persistent memory and reflection | EVE memory providers, provenance, search, indexing, and `eve memory reflect`                              |
| Completion with evidence         | Workboard proof, artifact, attachment, and completion-evidence records                                    |
| Automatic toolset choice         | `toolsets: ["auto"]` narrows worker sessions for coding, research, operations, visual, or communications  |
| Trace Studio                     | Redacted operational trace timeline and replay metadata                                                   |
| Evals 2.0                        | Repeated cases plus model, provider, tool, trajectory, latency, cost, artifact, and terminal-state checks |
| Durable flows                    | Dependency-aware steps, conditions, parallelism, wait/resume, retry, and fork                             |
| Result Hub                       | Versioned deliverables, artifacts, approval, changes requested, and archive state                         |
| Adaptive routing                 | Opt-in evidence-based same-provider selection for new sessions without mid-session switching              |
| Canary experiments               | Deterministic new-session assignment, automatic trace scoring, promotion, and stop state                  |
| Work packages                    | Research, software, operations, marketing, content, and support packages with transactional installation  |
| Distributed workers              | Authenticated pull controller, capabilities, priority, heartbeat, lease, retry, and remote runtime        |
| Model Lab                        | Dataset, comparison, candidate registration, activation, and rollback                                     |
| Mission Control                  | Workboard UI and CLI with agent ownership and operational controls                                        |
| Managed environments             | Docker lifecycle, limits, expiration, persistence, network control, and snapshots                         |
| Integrations store               | Current plugins/channels/MCP plus Athena's six reviewed optional MCP discovery entries                    |
| Artifact Studio                  | Versioned creation, import, editing, preview, download, and Result Hub publishing                         |
| Backup and offline recovery      | Verified restore, relocation, pre-restore backup, exact bundle manifest, and offline installer            |
| Controlled skill evolution       | Skill Workshop proposal, evaluation evidence, apply, and edit-safe rollback                               |

## Storage

EVE-owned runtime state is SQLite-first. Global operational data lives under
the active EVE state directory, normally `~/.eve`. Agent-scoped state remains
under each agent directory, and user artifacts such as backups, Studio files,
attachments, and offline bundles remain explicit files.

The principal EVE platform stores are:

```text
~/.eve/
├── state/eve.sqlite
├── agents/<agent-id>/agent/eve-agent.sqlite
├── operations/eve-operations.sqlite
├── plugins/workboard/workboard.sqlite
├── workboard/projects.sqlite
├── studio/
└── workspace/
```

Actual paths follow `EVE_STATE_DIR`, agent configuration, and workspace
configuration when those values are overridden.

## Operating boundaries

EVE's phase-one behavioral policy is empty. Operational controls such as
authentication, resource limits, path validation, plugin activation, tool
availability, and external provider rules remain separate technical contracts.
See [Owner-controlled policy](/concepts/owner-policy).

## Related

- [Operational intelligence CLI](/cli/intelligence)
- [Workboard CLI](/cli/workboard)
- [Owner-controlled policy](/concepts/owner-policy)
- [Linux server](/vps)
- [Offline operation](/cli/offline)
- [Control UI](/web/control-ui)
