# EVE Agent

EVE is an independent, self-hosted AI agent platform. It keeps the complete
multi-channel gateway, provider, tool, plugin, application, node, automation,
and session runtime in one project, then adds EVE's own operational platform
for projects, missions, durable work, evaluation, recovery, and offline use.

The npm package is `eve-agent`. The public command is `eve`, and persistent
state lives under `~/.eve` unless `EVE_STATE_DIR` overrides it.

## What EVE includes

- terminal chat, WebChat, Control UI, macOS, iOS, Android, and headless nodes;
- WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, Google Chat,
  Microsoft Teams, IRC, LINE, Feishu, and the other bundled channel plugins;
- OpenAI, Anthropic, Ollama, OpenRouter, Google, Bedrock, and compatible model
  providers with profiles, fallbacks, streaming, and tool calling;
- browser, shell, files, media, MCP, plugins, skills, cron, hooks, sessions,
  subagents, goals, memory, and sandbox backends;
- Mission Control and Workboard with projects, ownership, pause/resume/retry,
  reassignment, automatic toolset hints, and completion evidence;
- Trace Studio, Result Hub, trajectory-aware evaluations, durable flows,
  adaptive routing, canary experiments, Model Lab, and distributed workers;
- Docker environments with resource limits, expiration, persistence, network
  control, and snapshots;
- EVE Studio for versioned documents, presentations, spreadsheets, sites,
  diagrams, notes, imports, downloads, and publication to Result Hub;
- one integrations catalog for MCP servers, plugins, and channels;
- transactional work packages, verified backup restore, offline bundles, and
  a VPS installer;
- Skill Workshop proposals with scanning, review, application, and safe
  rollback that refuses to overwrite later edits.

See the [EVE platform overview](https://docs.eve.ai/concepts/eve-platform) for
the complete capability map.

## Phase-one owner policy

EVE currently adds no project-owned behavioral restriction, refusal rule, or
safety policy to the agent prompt. The first-party policy contract starts with
zero rules and allows every action presented to it. `SOUL.md` also starts empty
so the owner can design EVE's policy in a later phase.

This does not bypass the rules of a selected model/provider or an external
service. Authentication, sender pairing, filesystem boundaries, protocol
validation, resource limits, and explicit tool availability remain technical
runtime controls. See [Owner-controlled policy](https://docs.eve.ai/concepts/owner-policy).

## Install

EVE requires Node.js 22.19 or newer. Node.js 24 is recommended.

### npm

```bash
npm install -g eve-agent@latest
eve onboard --install-daemon
eve gateway status
```

### Source checkout

```bash
git clone https://github.com/engsathiago/eve-agent.git
cd eve-agent
corepack enable
pnpm install
pnpm build
pnpm eve onboard --install-daemon
```

### Linux VPS

```bash
git clone https://github.com/engsathiago/eve-agent.git
cd eve-agent
bash scripts/install-vps.sh --source-dir "$PWD" --interactive
```

For a provider-neutral non-interactive installation:

```bash
bash scripts/install-vps.sh --source-dir "$PWD" --non-interactive
```

The VPS installer installs the `eve` command, configures the Gateway, installs
the user service, runs `eve doctor`, and probes the service. Use loopback or a
private tailnet unless you intentionally configure authenticated remote access.

## First run

```bash
eve onboard --install-daemon
eve dashboard
eve status
eve doctor
```

Useful operational commands:

```bash
eve mission status
eve projects list
eve intelligence status
eve traces status
eve results status
eve flows status
eve evals status
eve router status
eve experiments status
eve workers status
eve model-lab status
eve environments status
eve studio list
eve integrations list
eve packages list
```

## Backup, restore, and offline use

```bash
eve backup create
eve backup restore ./eve-backup.tar.gz
eve backup restore ./eve-backup.tar.gz --apply

eve offline status
eve offline configure --model qwen3:8b
eve offline bundle --output /Volumes/USB/eve-offline
```

Restore defaults to a verified dry run. An applied restore creates a pre-restore
backup before replacing state. Offline bundles include an exact SHA-256
manifest and a network-free installer.

## Development

```bash
corepack enable
pnpm install
pnpm eve setup
pnpm gateway:watch
```

Build and focused validation:

```bash
pnpm build
node scripts/run-vitest.mjs <test-file>
node scripts/run-tsgo.mjs -p tsconfig.core.json
node scripts/run-tsgo.mjs -p tsconfig.extensions.json
```

## Data

The default layout is:

```text
~/.eve/
├── eve.json
├── agents/
├── credentials/
├── intelligence/
├── logs/
├── workboard/
└── workspace/
```

Do not commit credentials or a live state directory. Use `eve backup` before
upgrades, migrations, or restoration tests.

## Documentation

- [Getting started](https://docs.eve.ai/start/getting-started)
- [EVE platform](https://docs.eve.ai/concepts/eve-platform)
- [Owner-controlled policy](https://docs.eve.ai/concepts/owner-policy)
- [Operational intelligence CLI](https://docs.eve.ai/cli/intelligence)
- [Offline installation](https://docs.eve.ai/cli/offline)
- [Linux VPS](https://docs.eve.ai/vps)
- [Gateway configuration](https://docs.eve.ai/gateway/configuration)
- [Channels](https://docs.eve.ai/channels)
- [Plugins and skills](https://docs.eve.ai/tools)

## License and provenance

EVE is distributed under the MIT license. The fork preserves upstream
copyright notices and third-party license obligations in [LICENSE](LICENSE),
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and
[EVE_FORK_SOURCES.md](EVE_FORK_SOURCES.md). Those notices document provenance;
they do not define EVE's product identity or behavioral policy.

---

## Resumo em português

EVE é um agente independente e autocontido. O comando global é `eve`, o pacote
é `eve-agent`, e o projeto reúne o núcleo completo de canais, ferramentas,
provedores, plugins e aplicativos com as melhorias operacionais do Athena 0.4:
Central de Missão, projetos, ambientes, Studio, integrações, traces, resultados,
avaliações, fluxos, roteamento, experimentos, workers, Model Lab, pacotes,
recuperação e modo offline.

Na primeira fase, o EVE não injeta política comportamental própria. A política
do projeto será escrita pelo proprietário em uma segunda fase, sem alterar as
limitações externas do modelo ou do provedor escolhido.
