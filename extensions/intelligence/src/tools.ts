import { jsonResult, readStringParam, type AnyAgentTool } from "eve-agent/plugin-sdk/core";
import { Type } from "typebox";
import type { IntelligenceServices } from "./services.js";
import type {
  EveExperimentStatus,
  EveResultStatus,
  EveRouteCandidate,
  JsonObject,
} from "./types.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const Empty = Type.Object({}, { additionalProperties: false });

export function createIntelligenceTools(services: IntelligenceServices): AnyAgentTool[] {
  return [
    {
      name: "eve_intelligence_status",
      label: "EVE Intelligence Status",
      description:
        "Inspect traces, Result Hub, flows, routing, experiments, workers, evals, and Model Lab.",
      parameters: Empty,
      execute: async () =>
        jsonResult({
          traces: services.traces.status(),
          results: services.results.status(),
          flows: services.flows.status(),
          router: services.routing.routerStatus(),
          experiments: services.routing.listExperiments(),
          workers: services.workers.status(),
          evals: services.evals.status(),
          modelLab: services.modelLab.status(),
          environments: await services.environments.list(),
          studio: services.studio.list(),
          integrations: services.integrations.list(),
          packages: services.packages.list(),
        }),
    },
    {
      name: "eve_trace",
      label: "EVE Trace Studio",
      description: "List, inspect, replay, or prune EVE execution traces.",
      parameters: Type.Object(
        {
          action: Type.Union([
            Type.Literal("list"),
            Type.Literal("get"),
            Type.Literal("replay"),
            Type.Literal("prune"),
          ]),
          id: Type.Optional(Type.String()),
          status: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
          max_age_days: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
          keep_latest: Type.Optional(Type.Integer({ minimum: 100, maximum: 100000 })),
          execute: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action === "list") {
          return jsonResult({
            traces: services.traces.list({
              status: readStringParam(params, "status") as never,
              limit: number(params.limit, 50),
            }),
          });
        }
        if (action === "prune") {
          return jsonResult(
            services.traces.prune({
              maxAgeDays: number(params.max_age_days, 30),
              keepLatest: number(params.keep_latest, 5000),
              execute: params.execute === true,
            }),
          );
        }
        const id = readStringParam(params, "id", { required: true });
        if (action === "get") {
          return jsonResult(services.traces.get(id));
        }
        return jsonResult(services.traces.replay(id));
      },
    },
    {
      name: "eve_result",
      label: "EVE Result Hub",
      description: "List, inspect, approve, request changes, or archive deliverables.",
      parameters: Type.Object(
        {
          action: Type.Union([
            Type.Literal("list"),
            Type.Literal("get"),
            Type.Literal("approve"),
            Type.Literal("changes"),
            Type.Literal("archive"),
          ]),
          id: Type.Optional(Type.String()),
          status: Type.Optional(Type.String()),
          note: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action === "list") {
          return jsonResult({
            items: services.results.list({
              status: readStringParam(params, "status") as EveResultStatus | undefined,
              limit: number(params.limit, 100),
            }),
          });
        }
        const id = readStringParam(params, "id", { required: true });
        if (action === "get") {
          return jsonResult(services.results.get(id));
        }
        const status: EveResultStatus =
          action === "approve"
            ? "approved"
            : action === "changes"
              ? "changes_requested"
              : "archived";
        return jsonResult(
          services.results.updateStatus(id, status, readStringParam(params, "note")),
        );
      },
    },
    {
      name: "eve_flow",
      label: "EVE Durable Flow",
      description: "Start, run, inspect, resume, retry, or fork an operator-installed workflow.",
      parameters: Type.Object(
        {
          action: Type.Union([
            Type.Literal("status"),
            Type.Literal("start"),
            Type.Literal("run"),
            Type.Literal("get"),
            Type.Literal("resume"),
            Type.Literal("retry"),
            Type.Literal("fork"),
          ]),
          flow: Type.Optional(Type.String()),
          run_id: Type.Optional(Type.String()),
          step_id: Type.Optional(Type.String()),
          from_step: Type.Optional(Type.String()),
          input: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
          value: Type.Optional(Type.Unknown()),
          max_parallel: Type.Optional(Type.Integer({ minimum: 1, maximum: 32 })),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action === "status") {
          return jsonResult(services.flows.status());
        }
        if (action === "start") {
          const flow = readStringParam(params, "flow", { required: true });
          services.flows.assertModelRunnableDefinition(flow);
          return jsonResult(services.flows.start(flow, object(params.input)));
        }
        const runId = readStringParam(params, "run_id", { required: true });
        if (action === "get") {
          return jsonResult(services.flows.getRun(runId));
        }
        if (action === "run") {
          services.flows.assertModelRunnableRun(runId);
          return jsonResult(
            await services.flowEngine.run(runId, { maxParallel: number(params.max_parallel, 4) }),
          );
        }
        if (action === "resume") {
          services.flows.assertModelRunnableRun(runId);
          return jsonResult(
            await services.flowEngine.resume(runId, {
              stepId: readStringParam(params, "step_id"),
              value: params.value,
              maxParallel: number(params.max_parallel, 4),
            }),
          );
        }
        if (action === "retry") {
          services.flows.assertModelRunnableRun(runId);
          return jsonResult(
            await services.flowEngine.retry(
              runId,
              readStringParam(params, "step_id", { required: true }),
            ),
          );
        }
        services.flows.assertModelRunnableRun(runId);
        return jsonResult(
          services.flowEngine.fork(runId, readStringParam(params, "from_step", { required: true })),
        );
      },
    },
    {
      name: "eve_route",
      label: "EVE Adaptive Router",
      description: "Recommend a model from evidence or record a model outcome.",
      parameters: Type.Object(
        {
          action: Type.Union([
            Type.Literal("status"),
            Type.Literal("recommend"),
            Type.Literal("record"),
          ]),
          prompt: Type.Optional(Type.String()),
          candidates: Type.Optional(Type.Array(Type.Record(Type.String(), Type.Unknown()))),
          task_kind: Type.Optional(Type.String()),
          model: Type.Optional(Type.String()),
          provider: Type.Optional(Type.String()),
          success: Type.Optional(Type.Boolean()),
          quality: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
          latency_ms: Type.Optional(Type.Number({ minimum: 0 })),
          cost_usd: Type.Optional(Type.Number({ minimum: 0 })),
          tool_success: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action === "status") {
          return jsonResult(services.routing.routerStatus());
        }
        if (action === "recommend") {
          return jsonResult(
            services.routing.recommend(
              readStringParam(params, "prompt", { required: true }),
              (params.candidates ?? []) as EveRouteCandidate[],
              {
                currentModel: readStringParam(params, "model"),
                currentProvider: readStringParam(params, "provider"),
              },
            ),
          );
        }
        services.routing.record({
          taskKind: readStringParam(params, "task_kind", { required: true }),
          model: readStringParam(params, "model", { required: true }),
          provider: readStringParam(params, "provider"),
          success: params.success === true,
          quality: number(params.quality, params.success === true ? 1 : 0),
          latencyMs: number(params.latency_ms, 0),
          costUsd: number(params.cost_usd, 0),
          toolSuccess: number(params.tool_success, params.success === true ? 1 : 0),
        });
        return jsonResult({ recorded: true });
      },
    },
    {
      name: "eve_experiment",
      label: "EVE Canary Experiment",
      description:
        "Create, start, stop, inspect, assign, or score a deterministic canary experiment.",
      parameters: Type.Object(
        {
          action: Type.Union([
            Type.Literal("list"),
            Type.Literal("get"),
            Type.Literal("create"),
            Type.Literal("start"),
            Type.Literal("stop"),
            Type.Literal("assign"),
            Type.Literal("record"),
          ]),
          id: Type.Optional(Type.String()),
          name: Type.Optional(Type.String()),
          kind: Type.Optional(Type.String()),
          baseline: Type.Optional(Type.String()),
          candidate: Type.Optional(Type.String()),
          key: Type.Optional(Type.String()),
          arm: Type.Optional(Type.Union([Type.Literal("baseline"), Type.Literal("candidate")])),
          score: Type.Optional(Type.Number()),
          traffic_percent: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
          min_samples: Type.Optional(Type.Integer({ minimum: 1 })),
          max_regression: Type.Optional(Type.Number({ minimum: 0 })),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action === "list") {
          return jsonResult({ experiments: services.routing.listExperiments() });
        }
        if (action === "create") {
          return jsonResult(
            services.routing.createExperiment({
              name: readStringParam(params, "name", { required: true }),
              kind: readStringParam(params, "kind", { required: true }),
              baseline: readStringParam(params, "baseline", { required: true }),
              candidate: readStringParam(params, "candidate", { required: true }),
              trafficPercent: number(params.traffic_percent, 5),
              minSamples: number(params.min_samples, 20),
              maxRegression: number(params.max_regression, 0.02),
            }),
          );
        }
        const id = readStringParam(params, "id", { required: true });
        if (action === "get") {
          return jsonResult(services.routing.getExperiment(id));
        }
        if (action === "start" || action === "stop") {
          return jsonResult(
            services.routing.setExperimentStatus(
              id,
              (action === "start" ? "running" : "stopped") as EveExperimentStatus,
            ),
          );
        }
        if (action === "assign") {
          return jsonResult({
            arm: services.routing.assignExperiment(
              id,
              readStringParam(params, "key", { required: true }),
            ),
          });
        }
        return jsonResult(
          services.routing.recordExperiment(
            id,
            readStringParam(params, "arm", { required: true }) as "baseline" | "candidate",
            number(params.score, 0),
          ),
        );
      },
    },
    {
      name: "eve_worker",
      label: "EVE Distributed Worker",
      description: "Inspect aggregate distributed-worker capacity.",
      parameters: Type.Object(
        {
          action: Type.Literal("status"),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action !== "status") {
          throw new Error(
            "worker job operations require the operator CLI or authenticated Gateway RPC",
          );
        }
        return jsonResult(services.workers.status());
      },
    },
    {
      name: "eve_environment",
      label: "EVE Environments",
      description:
        "List, create, start, stop, restart, snapshot, sweep, or delete EVE-managed Docker environments.",
      parameters: Type.Object(
        {
          action: Type.Union([
            Type.Literal("list"),
            Type.Literal("create"),
            Type.Literal("start"),
            Type.Literal("stop"),
            Type.Literal("restart"),
            Type.Literal("snapshot"),
            Type.Literal("sweep"),
            Type.Literal("delete"),
          ]),
          id: Type.Optional(Type.String()),
          name: Type.Optional(Type.String()),
          image: Type.Optional(Type.String()),
          ttl_minutes: Type.Optional(Type.Integer({ minimum: 5 })),
          cpu: Type.Optional(Type.Number({ minimum: 0.1 })),
          memory_mb: Type.Optional(Type.Integer({ minimum: 128 })),
          persistent: Type.Optional(Type.Boolean()),
          network: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action === "list") {
          return jsonResult(await services.environments.list());
        }
        if (action === "sweep") {
          return jsonResult(await services.environments.sweepExpired());
        }
        if (action === "create") {
          return jsonResult(
            await services.environments.create({
              name: readStringParam(params, "name"),
              image: readStringParam(params, "image"),
              ttlMinutes: number(params.ttl_minutes, 120),
              cpu: number(params.cpu, 1),
              memoryMb: number(params.memory_mb, 1024),
              persistent: params.persistent === true,
              network: params.network === true,
            }),
          );
        }
        const id = readStringParam(params, "id", { required: true });
        if (action === "snapshot") {
          return jsonResult(
            await services.environments.snapshot(id, readStringParam(params, "name")),
          );
        }
        if (action === "delete") {
          return jsonResult(await services.environments.remove(id));
        }
        if (action !== "start" && action !== "stop" && action !== "restart") {
          throw new Error(`unknown environment action: ${action}`);
        }
        return jsonResult(await services.environments.control(id, action));
      },
    },
    {
      name: "eve_studio",
      label: "EVE Studio",
      description: "Create, inspect, edit, publish, or delete versioned EVE Studio artifacts.",
      parameters: Type.Object(
        {
          action: Type.Union([
            Type.Literal("list"),
            Type.Literal("get"),
            Type.Literal("create"),
            Type.Literal("save"),
            Type.Literal("publish"),
            Type.Literal("delete"),
          ]),
          id: Type.Optional(Type.String()),
          kind: Type.Optional(Type.String()),
          title: Type.Optional(Type.String()),
          filename: Type.Optional(Type.String()),
          content: Type.Optional(Type.String()),
          summary: Type.Optional(Type.String()),
          include_content: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        if (action === "list") {
          return jsonResult(services.studio.list());
        }
        if (action === "create") {
          return jsonResult(
            services.studio.create(readStringParam(params, "kind") || "document", {
              title: readStringParam(params, "title"),
              filename: readStringParam(params, "filename"),
            }),
          );
        }
        const id = readStringParam(params, "id", { required: true });
        if (action === "get") {
          return jsonResult(services.studio.get(id, params.include_content === true));
        }
        if (action === "save") {
          return jsonResult(
            services.studio.save(id, {
              content: readStringParam(params, "content", { required: true }),
              title: readStringParam(params, "title"),
            }),
          );
        }
        if (action === "publish") {
          return jsonResult(services.studio.publish(id, readStringParam(params, "summary")));
        }
        return jsonResult(services.studio.remove(id));
      },
    },
    {
      name: "eve_package",
      label: "EVE Work Packages",
      description: "List or install EVE professional work packages.",
      parameters: Type.Object(
        {
          action: Type.Union([Type.Literal("list"), Type.Literal("install")]),
          source: Type.Optional(Type.String()),
          force: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      execute: async (_id, raw) => {
        const params = record(raw);
        const action = readStringParam(params, "action", { required: true });
        return jsonResult(
          action === "list"
            ? services.packages.list()
            : services.packages.install(
                readStringParam(params, "source", { required: true }),
                params.force === true,
              ),
        );
      },
    },
  ];
}
