import { formatErrorMessage } from "eve-agent/plugin-sdk/error-runtime";
import type { EVEPluginApi } from "../api.js";
import type { IntelligenceServices } from "./services.js";
import type {
  EveExperimentStatus,
  EveFlowDefinition,
  EveResultStatus,
  EveRouteCandidate,
  EveTraceStatus,
  EveWorkerJob,
  JsonObject,
} from "./types.js";

type Scope = "operator.read" | "operator.write";
type Method = (params: Record<string, unknown>) => unknown;

function requiredString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function optionalString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(params: Record<string, unknown>, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function experimentStatus(value: string): EveExperimentStatus {
  if (value === "draft" || value === "running" || value === "promoted" || value === "stopped") {
    return value;
  }
  throw new Error(`invalid experiment status: ${value}`);
}

function experimentArm(value: string): "baseline" | "candidate" {
  if (value === "baseline" || value === "candidate") {
    return value;
  }
  throw new Error(`invalid experiment arm: ${value}`);
}

function objectValue(params: Record<string, unknown>, key: string): JsonObject {
  const value = params[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function stringList(params: Record<string, unknown>, key: string): string[] {
  const value = params[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function register(api: EVEPluginApi, name: string, scope: Scope, method: Method): void {
  api.registerGatewayMethod(
    name,
    async ({ params, respond }) => {
      try {
        respond(true, await method(params));
      } catch (error) {
        respond(false, undefined, {
          code: "intelligence_error",
          message: formatErrorMessage(error),
        });
      }
    },
    { scope },
  );
}

export function registerIntelligenceGatewayMethods(
  api: EVEPluginApi,
  services: IntelligenceServices,
): void {
  register(api, "intelligence.status", "operator.read", async () => ({
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
  }));

  register(api, "intelligence.traces.list", "operator.read", (params) => ({
    traces: services.traces.list({
      status: optionalString(params, "status") as EveTraceStatus | undefined,
      runKey: optionalString(params, "runKey"),
      limit: numberValue(params, "limit", 50),
    }),
  }));
  register(api, "intelligence.traces.get", "operator.read", (params) =>
    services.traces.get(requiredString(params, "id")),
  );
  register(api, "intelligence.traces.replay", "operator.read", (params) =>
    services.traces.replay(requiredString(params, "id")),
  );
  register(api, "intelligence.traces.prune", "operator.write", (params) =>
    services.traces.prune({
      maxAgeDays: numberValue(params, "maxAgeDays", 30),
      keepLatest: numberValue(params, "keepLatest", 5000),
      execute: params.execute === true,
    }),
  );

  register(api, "intelligence.results.list", "operator.read", (params) => ({
    items: services.results.list({
      status: optionalString(params, "status") as EveResultStatus | undefined,
      limit: numberValue(params, "limit", 100),
    }),
  }));
  register(api, "intelligence.results.get", "operator.read", (params) =>
    services.results.get(requiredString(params, "id")),
  );
  register(api, "intelligence.results.update", "operator.write", (params) =>
    services.results.updateStatus(
      requiredString(params, "id"),
      requiredString(params, "status") as EveResultStatus,
      optionalString(params, "note"),
    ),
  );
  register(api, "intelligence.results.addArtifact", "operator.write", (params) =>
    services.results.addArtifact(
      requiredString(params, "id"),
      requiredString(params, "path"),
      optionalString(params, "name"),
    ),
  );

  register(api, "intelligence.flows.status", "operator.read", () => services.flows.status());
  register(api, "intelligence.flows.get", "operator.read", (params) =>
    services.flows.getRun(requiredString(params, "runId")),
  );
  register(api, "intelligence.flows.install", "operator.write", (params) =>
    services.flows.install(objectValue(params, "definition") as EveFlowDefinition),
  );
  register(api, "intelligence.flows.start", "operator.write", (params) =>
    services.flows.start(requiredString(params, "flow"), objectValue(params, "input")),
  );
  register(
    api,
    "intelligence.flows.run",
    "operator.write",
    async (params) =>
      await services.flowEngine.run(requiredString(params, "runId"), {
        maxParallel: numberValue(params, "maxParallel", 4),
      }),
  );
  register(
    api,
    "intelligence.flows.resume",
    "operator.write",
    async (params) =>
      await services.flowEngine.resume(requiredString(params, "runId"), {
        stepId: optionalString(params, "stepId"),
        value: params.value,
        maxParallel: numberValue(params, "maxParallel", 4),
      }),
  );
  register(
    api,
    "intelligence.flows.retry",
    "operator.write",
    async (params) =>
      await services.flowEngine.retry(
        requiredString(params, "runId"),
        requiredString(params, "stepId"),
      ),
  );
  register(api, "intelligence.flows.fork", "operator.write", (params) =>
    services.flowEngine.fork(requiredString(params, "runId"), requiredString(params, "fromStep")),
  );

  register(api, "intelligence.evals.status", "operator.read", () => services.evals.status());
  register(api, "intelligence.evals.init", "operator.write", (params) =>
    services.evals.init(
      optionalString(params, "name") ?? "starter",
      numberValue(params, "count", 30),
      params.overwrite === true,
    ),
  );
  register(
    api,
    "intelligence.evals.run",
    "operator.write",
    async (params) =>
      await services.evals.run(requiredString(params, "suite"), {
        repetitions: numberValue(params, "repetitions", 1),
        timeoutMs: numberValue(params, "timeoutMs", 120_000),
      }),
  );
  register(api, "intelligence.evals.importTraces", "operator.write", (params) =>
    services.evals.importTraces(
      optionalString(params, "name") ?? "real-trajectories",
      numberValue(params, "limit", 50),
      params.includeFailed !== false,
    ),
  );
  register(api, "intelligence.evals.compare", "operator.read", (params) =>
    services.evals.compare(
      requiredString(params, "baseline"),
      requiredString(params, "candidate"),
      {
        maxRegression: numberValue(params, "maxRegression", 0.02),
        minImprovement: numberValue(params, "minImprovement", 0),
      },
    ),
  );

  register(api, "intelligence.router.status", "operator.read", () =>
    services.routing.routerStatus(),
  );
  register(api, "intelligence.router.recommend", "operator.read", (params) =>
    services.routing.recommend(
      requiredString(params, "prompt"),
      (Array.isArray(params.candidates) ? params.candidates : []) as EveRouteCandidate[],
      {
        currentModel: optionalString(params, "currentModel"),
        currentProvider: optionalString(params, "currentProvider"),
      },
    ),
  );
  register(api, "intelligence.router.record", "operator.write", (params) => {
    services.routing.record({
      taskKind: requiredString(params, "taskKind"),
      model: requiredString(params, "model"),
      provider: optionalString(params, "provider"),
      success: params.success === true,
      quality: numberValue(params, "quality", params.success === true ? 1 : 0),
      latencyMs: numberValue(params, "latencyMs", 0),
      costUsd: numberValue(params, "costUsd", 0),
      toolSuccess: numberValue(params, "toolSuccess", params.success === true ? 1 : 0),
      metadata: objectValue(params, "metadata"),
    });
    return { recorded: true };
  });

  register(api, "intelligence.experiments.list", "operator.read", () => ({
    experiments: services.routing.listExperiments(),
  }));
  register(api, "intelligence.experiments.get", "operator.read", (params) =>
    services.routing.getExperiment(requiredString(params, "id")),
  );
  register(api, "intelligence.experiments.create", "operator.write", (params) =>
    services.routing.createExperiment({
      name: requiredString(params, "name"),
      kind: requiredString(params, "kind"),
      baseline: requiredString(params, "baseline"),
      candidate: requiredString(params, "candidate"),
      trafficPercent: numberValue(params, "trafficPercent", 5),
      minSamples: numberValue(params, "minSamples", 20),
      maxRegression: numberValue(params, "maxRegression", 0.02),
      metadata: objectValue(params, "metadata"),
    }),
  );
  register(api, "intelligence.experiments.status", "operator.write", (params) =>
    services.routing.setExperimentStatus(
      requiredString(params, "id"),
      experimentStatus(requiredString(params, "status")),
    ),
  );
  register(api, "intelligence.experiments.assign", "operator.read", (params) => ({
    arm: services.routing.assignExperiment(
      requiredString(params, "id"),
      requiredString(params, "key"),
    ),
  }));
  register(api, "intelligence.experiments.record", "operator.write", (params) =>
    services.routing.recordExperiment(
      requiredString(params, "id"),
      experimentArm(requiredString(params, "arm")),
      numberValue(params, "score", 0),
    ),
  );

  register(api, "intelligence.workers.status", "operator.read", () => services.workers.status());
  register(api, "intelligence.workers.register", "operator.write", (params) =>
    services.workers.registerNode({
      id: requiredString(params, "id"),
      name: optionalString(params, "name"),
      endpoint: optionalString(params, "endpoint"),
      labels: stringList(params, "labels"),
      capabilities: stringList(params, "capabilities"),
      maxJobs: numberValue(params, "maxJobs", 1),
      metadata: objectValue(params, "metadata"),
    }),
  );
  register(api, "intelligence.workers.heartbeat", "operator.write", (params) =>
    services.workers.heartbeat(
      requiredString(params, "id"),
      params.activeJobs === undefined ? undefined : numberValue(params, "activeJobs", 0),
    ),
  );
  register(api, "intelligence.workers.submit", "operator.write", (params) =>
    services.workers.submit({
      kind: requiredString(params, "kind"),
      payload: objectValue(params, "payload"),
      requirements: stringList(params, "requirements"),
      priority: numberValue(params, "priority", 0),
      maxAttempts: numberValue(params, "maxAttempts", 3),
    }),
  );
  register(api, "intelligence.workers.claim", "operator.write", (params) => ({
    job:
      services.workers.claim(
        requiredString(params, "nodeId"),
        numberValue(params, "leaseMs", 900_000),
      ) ?? null,
  }));
  register(api, "intelligence.workers.complete", "operator.write", (params) =>
    services.workers.complete(requiredString(params, "nodeId"), requiredString(params, "jobId"), {
      attempt: numberValue(params, "attempt", 0),
      result: objectValue(params, "result"),
      error: optionalString(params, "error"),
    }),
  );
  register(api, "intelligence.workers.jobs", "operator.read", (params) => ({
    jobs: services.workers.listJobs({
      status: optionalString(params, "status") as EveWorkerJob["status"] | undefined,
      limit: numberValue(params, "limit", 100),
    }),
  }));

  register(api, "intelligence.modelLab.status", "operator.read", () => services.modelLab.status());
  register(api, "intelligence.modelLab.dataset", "operator.write", (params) =>
    services.modelLab.prepareDataset(
      requiredString(params, "path"),
      optionalString(params, "name") ?? "dataset",
    ),
  );
  register(api, "intelligence.modelLab.compare", "operator.write", (params) =>
    services.modelLab.compare(
      requiredString(params, "baseline"),
      requiredString(params, "candidate"),
      {
        candidateName: requiredString(params, "candidateName"),
        maxRegression: numberValue(params, "maxRegression", 0.02),
        minImprovement: numberValue(params, "minImprovement", 0),
        required: Object.fromEntries(
          Object.entries(objectValue(params, "required")).map(([key, value]) => [
            key,
            Number(value),
          ]),
        ),
      },
    ),
  );
  register(api, "intelligence.modelLab.register", "operator.write", (params) =>
    services.modelLab.register(
      requiredString(params, "name"),
      requiredString(params, "modelRef"),
      optionalString(params, "evaluation"),
    ),
  );
  register(api, "intelligence.modelLab.activate", "operator.write", (params) =>
    services.modelLab.activate(requiredString(params, "name"), params.allowUnverified === true),
  );
  register(api, "intelligence.modelLab.rollback", "operator.write", () =>
    services.modelLab.rollback(),
  );

  register(
    api,
    "intelligence.environments.list",
    "operator.read",
    async () => await services.environments.list(),
  );
  register(
    api,
    "intelligence.environments.create",
    "operator.write",
    async (params) =>
      await services.environments.create({
        name: optionalString(params, "name"),
        image: optionalString(params, "image"),
        ttlMinutes: numberValue(params, "ttlMinutes", 120),
        cpu: numberValue(params, "cpu", 1),
        memoryMb: numberValue(params, "memoryMb", 1024),
        persistent: params.persistent === true,
        network: params.network === true,
      }),
  );
  register(api, "intelligence.environments.control", "operator.write", async (params) => {
    const action = requiredString(params, "action");
    if (action !== "start" && action !== "stop" && action !== "restart") {
      throw new Error("action must be start, stop, or restart");
    }
    return await services.environments.control(requiredString(params, "id"), action);
  });
  register(
    api,
    "intelligence.environments.snapshot",
    "operator.write",
    async (params) =>
      await services.environments.snapshot(
        requiredString(params, "id"),
        optionalString(params, "name"),
      ),
  );
  register(
    api,
    "intelligence.environments.delete",
    "operator.write",
    async (params) => await services.environments.remove(requiredString(params, "id")),
  );
  register(
    api,
    "intelligence.environments.sweep",
    "operator.write",
    async () => await services.environments.sweepExpired(),
  );

  register(api, "intelligence.studio.list", "operator.read", () => services.studio.list());
  register(api, "intelligence.studio.get", "operator.read", (params) =>
    services.studio.get(requiredString(params, "id"), params.includeContent === true),
  );
  register(api, "intelligence.studio.create", "operator.write", (params) =>
    services.studio.create(optionalString(params, "kind") ?? "document", {
      title: optionalString(params, "title"),
      filename: optionalString(params, "filename"),
    }),
  );
  register(api, "intelligence.studio.import", "operator.write", (params) =>
    services.studio.import({
      filename: requiredString(params, "filename"),
      dataBase64: requiredString(params, "dataBase64"),
      title: optionalString(params, "title"),
    }),
  );
  register(api, "intelligence.studio.save", "operator.write", (params) => {
    if (typeof params.content !== "string") {
      throw new Error("content must be a string");
    }
    return services.studio.save(requiredString(params, "id"), {
      content: params.content,
      title: optionalString(params, "title"),
    });
  });
  register(api, "intelligence.studio.publish", "operator.write", (params) =>
    services.studio.publish(requiredString(params, "id"), optionalString(params, "summary")),
  );
  register(api, "intelligence.studio.delete", "operator.write", (params) =>
    services.studio.remove(requiredString(params, "id")),
  );

  register(api, "intelligence.integrations.list", "operator.read", () =>
    services.integrations.list(),
  );
  register(api, "intelligence.packages.list", "operator.read", () => services.packages.list());
  register(api, "intelligence.packages.install", "operator.write", (params) =>
    services.packages.install(requiredString(params, "source"), params.force === true),
  );
}
