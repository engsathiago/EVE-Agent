import path from "node:path";
import type { EVEPluginApi } from "../api.js";
import { openOperationsDatabase, type OperationsDatabase } from "./database.js";
import { EnvironmentManager } from "./environment-manager.js";
import { EvalSuiteService } from "./eval-suite.js";
import { FlowEngine } from "./flow-engine.js";
import { FlowStore } from "./flow-store.js";
import { IntegrationCatalog } from "./integration-catalog.js";
import { ModelLabService } from "./model-lab.js";
import { ResultStore } from "./result-store.js";
import { RoutingStore } from "./routing-store.js";
import { StudioStore } from "./studio-store.js";
import { TraceStore } from "./trace-store.js";
import type { EveFlowStepDefinition, EveRouteCandidate, JsonObject } from "./types.js";
import { WorkPackageStore } from "./work-package-store.js";
import { WorkerStore } from "./worker-store.js";

export type IntelligenceServices = {
  database: OperationsDatabase;
  traces: TraceStore;
  results: ResultStore;
  flows: FlowStore;
  flowEngine: FlowEngine;
  evals: EvalSuiteService;
  modelLab: ModelLabService;
  routing: RoutingStore;
  routingOptions: {
    enabled: boolean;
    candidates: EveRouteCandidate[];
  };
  workers: WorkerStore;
  environments: EnvironmentManager;
  studio: StudioStore;
  integrations: IntegrationCatalog;
  packages: WorkPackageStore;
  traceOptions: {
    captureContent: boolean;
    maxAgeDays: number;
    keepLatest: number;
  };
  close: () => void;
};

function assistantResponse(messages: unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const outer = item as Record<string, unknown>;
    const message =
      outer.message && typeof outer.message === "object" && !Array.isArray(outer.message)
        ? (outer.message as Record<string, unknown>)
        : outer;
    if (message.role !== "assistant") {
      continue;
    }
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
    if (Array.isArray(message.content)) {
      const response = message.content
        .flatMap((part) => {
          if (!part || typeof part !== "object" || Array.isArray(part)) {
            return [];
          }
          const block = part as Record<string, unknown>;
          return (block.type === "text" || block.type === "output_text") &&
            typeof block.text === "string"
            ? [block.text]
            : [];
        })
        .join("\n")
        .trim();
      if (response) {
        return response;
      }
    }
  }
  return undefined;
}

export async function runAgentStep(
  api: EVEPluginApi,
  step: EveFlowStepDefinition,
  context: {
    runId: string;
    attempt: number;
    input: JsonObject;
    steps: Record<string, { output: JsonObject }>;
  },
): Promise<JsonObject> {
  const prompt =
    typeof step.prompt === "string" ? step.prompt : (JSON.stringify(step.value ?? "") ?? "");
  const sessionKey = `subagent:flow-${context.runId}-${step.id}`;
  const run = await api.runtime.subagent.run({
    sessionKey,
    message: prompt,
    lane: `flow:${context.runId}:${step.id}`,
    idempotencyKey: `flow:${context.runId}:${step.id}:attempt:${context.attempt}`,
    lightContext: true,
    deliver: false,
  });
  const waited = await api.runtime.subagent.waitForRun({
    runId: run.runId,
    timeoutMs: 30 * 60_000,
  });
  if (waited.status !== "ok") {
    throw new Error(waited.error || `agent flow step ended with status ${waited.status}`);
  }
  const { messages } = await api.runtime.subagent.getSessionMessages({ sessionKey, limit: 50 });
  const response = assistantResponse(messages);
  if (!response) {
    throw new Error("agent flow step completed without an assistant response");
  }
  return {
    runId: run.runId,
    sessionKey,
    status: "ok",
    response,
  };
}

export function createIntelligenceServices(
  api: EVEPluginApi,
  dbPath?: string,
): IntelligenceServices {
  const database = openOperationsDatabase(dbPath);
  const pluginConfig = api.pluginConfig ?? {};
  const numberConfig = (key: string, fallback: number): number => {
    const value = pluginConfig[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const traceOptions = {
    captureContent: pluginConfig.traceCaptureContent === true,
    maxAgeDays: numberConfig("traceRetentionDays", 30),
    keepLatest: numberConfig("traceKeepLatest", 5000),
  };
  const routingOptions = {
    enabled: pluginConfig.adaptiveRoutingEnabled === true,
    candidates: Array.isArray(pluginConfig.adaptiveRoutingCandidates)
      ? pluginConfig.adaptiveRoutingCandidates.flatMap((value): EveRouteCandidate[] => {
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return [];
          }
          const candidate = value as Record<string, unknown>;
          if (typeof candidate.model !== "string" || !candidate.model.trim()) {
            return [];
          }
          return [
            {
              model: candidate.model.trim(),
              ...(typeof candidate.provider === "string" && candidate.provider.trim()
                ? { provider: candidate.provider.trim() }
                : {}),
              ...(Array.isArray(candidate.tasks)
                ? {
                    tasks: candidate.tasks.filter(
                      (task): task is string => typeof task === "string" && Boolean(task.trim()),
                    ),
                  }
                : {}),
              ...(typeof candidate.expectedLatencyMs === "number"
                ? { expectedLatencyMs: candidate.expectedLatencyMs }
                : {}),
              ...(typeof candidate.expectedCostUsd === "number"
                ? { expectedCostUsd: candidate.expectedCostUsd }
                : {}),
            },
          ];
        })
      : [],
  };
  const traces = new TraceStore(database);
  traces.prune({ ...traceOptions, execute: true });
  const results = new ResultStore(database);
  const flows = new FlowStore(database);
  const routing = new RoutingStore(database, routingOptions);
  const workers = new WorkerStore(database, results);
  const evals = new EvalSuiteService(traces);
  const modelLab = new ModelLabService(undefined, api.runtime.config);
  const environments = new EnvironmentManager(database, {
    limits: {
      maxRunning: numberConfig("environmentMaxRunning", 8),
      maxTotalCpu: numberConfig("environmentMaxTotalCpu", 16),
      maxTotalMemoryMb: numberConfig("environmentMaxTotalMemoryMb", 32_768),
    },
  });
  const studio = new StudioStore(database, results);
  const extensionRoot = api.rootDir ?? path.dirname(api.source);
  const bundledRoot =
    path.basename(extensionRoot) === "intelligence" ? path.dirname(extensionRoot) : extensionRoot;
  const integrations = new IntegrationCatalog(api, bundledRoot);
  const packages = new WorkPackageStore(flows, evals, path.join(extensionRoot, "work-packages"));
  const flowEngine = new FlowEngine(
    flows,
    results,
    async (step, context) => await runAgentStep(api, step, context),
  );
  return {
    database,
    traces,
    results,
    flows,
    flowEngine,
    evals,
    modelLab,
    routing,
    routingOptions,
    workers,
    environments,
    studio,
    integrations,
    packages,
    traceOptions,
    close: () => database.close(),
  };
}
