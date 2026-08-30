---
summary: "CLI reference for EVE traces, results, evals, flows, routing, experiments, workers, Model Lab, environments, Studio, integrations, and work packages"
read_when:
  - You want to operate EVE intelligence from the terminal
  - You need durable flows, evaluations, routing, workers, or Result Hub commands
  - You are automating EVE projects, environments, Studio, or work packages
title: "Operational intelligence CLI"
sidebarTitle: "Intelligence"
---

EVE's operational intelligence commands share one SQLite-backed service layer
with the Control UI, Gateway RPC, and agent tools.

## Inspect everything

```bash
eve intelligence status
eve intelligence status --json
```

The status contains traces, results, flows, routing, experiments, workers,
evaluations, Model Lab, environments, Studio artifacts, integrations, and work
packages.

The integration catalog combines installed plugins, communication channels,
configured MCP servers, and the six optional MCP entries reviewed for Athena
0.4: Blender, Comfy Cloud, Figma, Linear, n8n, and Unreal Engine. Selecting an
item continues into EVE's canonical plugin, channel, or MCP manager.

## Trace Studio and Result Hub

```bash
eve traces status
eve traces list
eve traces show <trace-id>
eve traces replay <trace-id>
eve traces prune --days 30 --keep 5000
eve traces prune --days 30 --keep 5000 --execute

eve results status
eve results list
eve results show <result-id>
eve results approve <result-id>
eve results changes <result-id> --note "Revise the summary"
eve results add-artifact <result-id> ./report.pdf
eve results archive <result-id>
```

Trace pruning is a preview unless `--execute` is present. EVE also applies the
configured retention window automatically on startup and hourly. Each model
call also records the effective context budget, reference window, unit, and
source as a `context_selected` event. Prompt and assistant
content are not persisted by default; explicitly set
`plugins.entries.intelligence.config.traceCaptureContent=true` if redacted
content capture is required. With capture disabled, tool arguments and results
are reduced to names, timing, status, and boolean presence metadata. Result
artifacts are hashed, versioned, and confined to their result directory.

## Evaluations

```bash
eve evals init starter --count 30
eve evals run starter --repetitions 3
eve evals import-traces regression --limit 50 --only-completed
eve evals compare <baseline-run> <candidate-run>
eve evals ci starter --min-score 0.9
```

Evaluation checks can cover response content, tools, model, provider, latency,
cost, trace status, artifacts, and terminal state.

## Durable flows

```bash
eve flows init ./release.yaml
eve flows install ./release.yaml
eve flows start release --input '{"version":"1.0"}' --run
eve flows show <run-id>
eve flows resume <run-id> --step approval --value '"approved"'
eve flows retry <run-id> <step-id>
eve flows fork <run-id> <step-id>
```

Flows support dependencies, conditions, parallel steps, wait states,
checkpoints, retries, and forks. Set `retries` from `0` to `100` on a step to
repeat transient failures automatically; `eve flows retry` remains the manual
operator path after a retry budget is exhausted. Each run keeps an immutable definition
snapshot and an execution lease prevents duplicate side effects across
concurrent processes. Command flows remain fully available to the operator CLI
and authenticated Gateway RPC; the model-facing `eve_flow` tool runs only
operator-installed flows without host command steps.

## Routing and experiments

```bash
eve router status
eve router recommend "Review this TypeScript service" \
  --candidate openai/gpt-5.5 \
  --candidate ollama/qwen3:8b

eve experiments create routing-v2 \
  --kind model-routing \
  --baseline gpt-5.5 \
  --candidate qwen3:8b \
  --traffic 5
eve experiments start routing-v2
eve experiments status routing-v2
```

Routing recommendations use recorded evidence. EVE does not silently switch
models in the middle of an existing session. Automatic routing is opt-in and
considers only candidates on the provider already selected for the session:

```json5
{
  plugins: {
    entries: {
      intelligence: {
        config: {
          adaptiveRoutingEnabled: true,
          adaptiveRoutingCandidates: [
            {
              provider: "openai",
              model: "gpt-5.5",
              tasks: ["coding", "analysis"],
              expectedLatencyMs: 3000,
            },
            {
              provider: "openai",
              model: "gpt-5.4",
              tasks: ["general"],
              expectedLatencyMs: 1800,
            },
          ],
        },
      },
    },
  },
}
```

The first turn of a new session chooses from observed quality, success, tool,
latency, and cost outcomes, then pins that model to the session. Explicit user
model selections win. Cross-provider candidates remain visible to manual
recommendation commands because changing credentials or provider protocols is
an operator decision. A running `model-routing` experiment can assign its
baseline or candidate on that first turn; completed traces update the assigned
arm automatically.

## Distributed workers

Give the controller a separate operator token and one token per worker node:

```bash
export EVE_WORKER_OPERATOR_TOKEN='<LONG_RANDOM_OPERATOR_TOKEN>'
export EVE_WORKER_TOKENS='gpu-01=<GPU_NODE_TOKEN>,cpu-01=<CPU_NODE_TOKEN>'
eve workers serve --bind 0.0.0.0 --port 9121
```

On a worker machine:

```bash
export EVE_WORKER_TOKEN='<GPU_NODE_TOKEN>'
eve workers run \
  --controller https://controller.example.com \
  --id gpu-01 \
  --labels gpu,linux \
  --capabilities agent,command
```

Submit and inspect jobs:

```bash
eve workers submit agent '{"prompt":"Generate the report"}' \
  --requirements gpu \
  --priority 10
eve workers jobs
```

Worker capabilities must include the submitted job kind (`agent`, `eve`,
`command`, or `flow`) in addition to any job requirements. Use TLS, a private
network, or a reverse proxy when the controller crosses an untrusted network.
Every controller bind, including loopback, requires an operator token and at
least one node-bound worker token. A worker credential cannot inspect or submit
jobs and cannot impersonate another node. Model-facing worker tools cannot
submit host `command` jobs; those remain available through the operator CLI and
authenticated Gateway RPC.

## Model Lab

```bash
eve model-lab status
eve model-lab dataset ./dataset.jsonl
eve model-lab compare <baseline> <candidate> --name <candidate-name>
eve model-lab register <candidate-name> <provider/model> --evaluation <report-path>
eve model-lab activate <candidate-name>
eve model-lab rollback
```

Use `eve model-lab <command> --help` for the exact dataset, comparison, and
candidate options.

## Environments, Studio, and integrations

```bash
eve environments create review-box --cpu 2 --memory 4096 --ttl 120
eve environments snapshot <environment-id> --name before-upgrade
eve environments stop <environment-id>
eve environments delete <environment-id>

eve studio create document --title "Release report"
eve studio import ./report.pdf
eve studio publish <artifact-id> --summary "Ready for review"

eve integrations list
```

Docker is required for managed environments. Network access is disabled unless
`--network` is provided. Studio imports and inline Studio content reads are
limited to 16 MB so one Gateway request remains below the WebSocket frame cap.

## Work packages

```bash
eve packages list
eve packages install research
```

Bundled packages include `content`, `marketing`, `operations`, `research`,
`software`, and `support`. Installation is transactional: EVE restores prior
package state when any step fails.

## Mission Control and projects

```bash
eve projects create "Release engineering" --folder /srv/eve/release
eve mission create "Prepare release" --agent main --board release-engineering
eve mission instruct <mission-id> "Include upgrade proof"
eve mission pause <mission-id>
eve mission resume <mission-id>
eve mission reassign <mission-id> release-agent
```

Mission Control uses Workboard cards, so tasks created in the UI, CLI, Gateway,
or agent tools remain consistent.

## Related

- [EVE platform](/concepts/eve-platform)
- [Workboard CLI](/cli/workboard)
- [Control UI](/web/control-ui)
- [Offline operation](/cli/offline)
