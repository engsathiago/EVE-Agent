import type { EVEPluginApi } from "../api.js";
import { classifyTask } from "./routing-store.js";
import { sanitizeObject } from "./sanitize.js";
import type { IntelligenceServices } from "./services.js";
import type { EveTraceRun, JsonObject } from "./types.js";

function tracePayload(
  services: IntelligenceServices,
  full: JsonObject,
  minimal: JsonObject,
): JsonObject {
  return sanitizeObject(services.traceOptions.captureContent ? full : minimal);
}

function ensureTrace(
  services: IntelligenceServices,
  input: {
    runId?: string;
    sessionId?: string;
    sessionKey?: string;
    agentId?: string;
    platform?: string;
    model?: string;
    provider?: string;
    metadata?: JsonObject;
  },
): EveTraceRun | undefined {
  if (!input.runId) {
    return undefined;
  }
  return services.traces.ensure({
    runKey: input.runId,
    sessionId: input.sessionId,
    sessionKey: input.sessionKey,
    agentId: input.agentId,
    platform: input.platform,
    model: input.model,
    provider: input.provider,
    metadata: input.metadata,
  });
}

function finalizeTrace(
  services: IntelligenceServices,
  runId: string | undefined,
  status: "completed" | "failed" | "interrupted" | "closed",
  summary = "",
): void {
  if (!runId) {
    return;
  }
  const trace = services.traces.findByRunKey(runId);
  if (!trace || trace.status !== "running") {
    return;
  }
  const completed = services.traces.finish(trace.id, status, summary);
  services.results.create({
    sourceType: "trace",
    sourceId: completed.id,
    title: `Agent run ${completed.runKey}`,
    summary: completed.summary || `Run finished as ${completed.status}`,
    status: completed.status === "completed" ? "ready" : "failed",
    metadata: { traceId: completed.id, runKey: completed.runKey },
  });
  services.routing.record({
    taskKind:
      typeof completed.metadata.taskKind === "string"
        ? completed.metadata.taskKind
        : classifyTask(
            typeof completed.metadata.prompt === "string" ? completed.metadata.prompt : "",
          ),
    model: completed.model,
    provider: completed.provider,
    success: completed.status === "completed",
    quality: completed.status === "completed" ? 1 : 0,
    latencyMs: (completed.endedAt ?? Date.now()) - completed.startedAt,
    costUsd: completed.estimatedCostUsd,
    toolSuccess: completed.errorCount === 0 ? 1 : 0,
    metadata: { traceId: completed.id },
  });
  const experiment = completed.metadata.experiment;
  const assignment =
    experiment && typeof experiment === "object" && !Array.isArray(experiment)
      ? (experiment as Record<string, unknown>)
      : undefined;
  if (
    assignment &&
    typeof assignment.id === "string" &&
    (assignment.arm === "baseline" || assignment.arm === "candidate")
  ) {
    services.routing.recordExperiment(
      assignment.id,
      assignment.arm,
      completed.status === "completed" ? 1 : 0,
    );
  }
}

export function registerTraceHooks(api: EVEPluginApi, services: IntelligenceServices): void {
  api.on("llm_input", (event, ctx) => {
    const sanitizedPrompt = sanitizeObject({ prompt: event.prompt }).prompt;
    const captureContent = services.traceOptions.captureContent;
    const assignment = ctx.sessionKey
      ? api.runtime.agent?.session.getSessionEntry({
          agentId: ctx.agentId,
          sessionKey: ctx.sessionKey,
        })?.pluginExtensions?.intelligence?.experiment
      : undefined;
    const trace = ensureTrace(services, {
      runId: event.runId,
      sessionId: event.sessionId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      platform: ctx.channel ?? ctx.messageProvider ?? "agent",
      model: event.model,
      provider: event.provider,
      metadata: {
        taskKind: classifyTask(event.prompt),
        promptLength: event.prompt.length,
        ...(captureContent ? { prompt: sanitizedPrompt } : {}),
        historyMessages: event.historyMessages.length,
        images: event.imagesCount,
        evaluationRunKey: process.env.EVE_EVAL_RUN_KEY ?? "",
        flowRunId: process.env.EVE_FLOW_RUN_ID ?? "",
        experiment: assignment ?? process.env.EVE_EXPERIMENT ?? "",
      },
    });
    if (!trace) {
      return;
    }
    services.traces.append(trace.id, {
      eventType: "llm_input",
      spanKey: event.runId,
      payload: sanitizeObject({
        ...(captureContent ? { prompt: sanitizedPrompt } : {}),
        promptLength: event.prompt.length,
        provider: event.provider,
        model: event.model,
        historyMessages: event.historyMessages.length,
        images: event.imagesCount,
        tools: event.tools,
      }),
    });
  });

  api.on("model_call_started", (event, ctx) => {
    const trace = ensureTrace(services, {
      runId: event.runId,
      sessionId: event.sessionId ?? ctx.sessionId,
      sessionKey: event.sessionKey ?? ctx.sessionKey,
      agentId: ctx.agentId,
      platform: ctx.channel ?? "agent",
      model: event.model,
      provider: event.provider,
    });
    if (!trace) {
      return;
    }
    const contextTokenBudget = event.contextTokenBudget ?? ctx.contextTokenBudget;
    const contextWindowSource = event.contextWindowSource ?? ctx.contextWindowSource;
    const contextWindowReferenceTokens =
      event.contextWindowReferenceTokens ?? ctx.contextWindowReferenceTokens;
    const contextSelection = sanitizeObject({
      ...(contextTokenBudget === undefined ? {} : { contextBudget: contextTokenBudget }),
      ...(contextWindowSource === undefined ? {} : { contextWindowSource }),
      ...(contextWindowReferenceTokens === undefined
        ? {}
        : { contextReference: contextWindowReferenceTokens }),
      ...(contextTokenBudget === undefined && contextWindowReferenceTokens === undefined
        ? {}
        : { contextUnit: "tokens" }),
    });
    if (Object.keys(contextSelection).length > 0) {
      services.traces.append(trace.id, {
        eventType: "context_selected",
        spanKey: event.callId,
        payload: contextSelection,
      });
    }
    services.traces.recordModelStart(trace.id, event.model, event.provider);
    services.traces.append(trace.id, {
      eventType: "model_call_started",
      spanKey: event.callId,
      payload: tracePayload(services, event, {
        callId: event.callId,
        model: event.model,
        provider: event.provider,
        ...contextSelection,
      }),
    });
  });

  api.on("model_call_ended", (event) => {
    const trace = services.traces.findByRunKey(event.runId);
    if (!trace) {
      return;
    }
    if (event.outcome === "error") {
      services.traces.recordError(trace.id, true);
    }
    services.traces.append(trace.id, {
      eventType: "model_call_ended",
      spanKey: event.callId,
      durationMs: event.durationMs,
      status: event.outcome,
      payload: tracePayload(services, event, {
        callId: event.callId,
        outcome: event.outcome,
        durationMs: event.durationMs,
      }),
    });
  });

  api.on("llm_output", (event) => {
    const trace = services.traces.findByRunKey(event.runId);
    if (!trace) {
      return;
    }
    services.traces.recordUsage(trace.id, event.usage ?? {});
    const summary = event.assistantTexts.at(-1) ?? "";
    const sanitizedSummary = sanitizeObject({ summary }).summary;
    services.traces.setSummary(
      trace.id,
      services.traceOptions.captureContent
        ? typeof sanitizedSummary === "string"
          ? sanitizedSummary
          : ""
        : `Assistant output: ${summary.length} characters`,
    );
    services.traces.append(trace.id, {
      eventType: "llm_output",
      spanKey: event.runId,
      payload: sanitizeObject({
        provider: event.provider,
        model: event.model,
        resolvedRef: event.resolvedRef,
        usage: event.usage,
        contextTokenBudget: event.contextTokenBudget,
        contextWindowSource: event.contextWindowSource,
        contextWindowReferenceTokens: event.contextWindowReferenceTokens,
        ...(services.traceOptions.captureContent
          ? { assistantTexts: event.assistantTexts }
          : {
              assistantTextCount: event.assistantTexts.length,
              assistantTextCharacters: event.assistantTexts.reduce(
                (total, text) => total + text.length,
                0,
              ),
            }),
      }),
    });
  });

  api.on("before_tool_call", (event, ctx) => {
    const trace = ensureTrace(services, {
      runId: event.runId ?? ctx.runId,
      sessionId: ctx.sessionId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      platform: ctx.channelId ?? "agent",
    });
    if (!trace) {
      return;
    }
    services.traces.recordToolStart(trace.id);
    services.traces.append(trace.id, {
      eventType: "before_tool_call",
      spanKey: event.toolCallId ?? ctx.toolCallId,
      payload: tracePayload(
        services,
        { toolName: event.toolName, params: event.params },
        { toolName: event.toolName },
      ),
    });
  });

  api.on("after_tool_call", (event, ctx) => {
    const trace = services.traces.findByRunKey(event.runId ?? ctx.runId ?? "");
    if (!trace) {
      return;
    }
    if (event.error) {
      services.traces.recordError(trace.id);
    }
    services.traces.append(trace.id, {
      eventType: "after_tool_call",
      spanKey: event.toolCallId ?? ctx.toolCallId,
      durationMs: event.durationMs,
      status: event.error ? "error" : "completed",
      payload: tracePayload(
        services,
        { toolName: event.toolName, result: event.result, error: event.error },
        {
          toolName: event.toolName,
          hasResult: event.result !== undefined,
          error: Boolean(event.error),
        },
      ),
    });
  });

  api.on("subagent_spawned", (event, ctx) => {
    const trace = ensureTrace(services, {
      runId: ctx.runId,
      sessionKey: ctx.requesterSessionKey,
      platform: "subagent",
    });
    if (trace) {
      services.traces.append(trace.id, {
        eventType: "subagent_spawned",
        spanKey: event.runId,
        payload: tracePayload(services, event, { runId: event.runId }),
      });
    }
  });

  api.on("subagent_ended", (event, ctx) => {
    const trace = services.traces.findByRunKey(ctx.runId ?? "");
    if (trace) {
      services.traces.append(trace.id, {
        eventType: "subagent_ended",
        spanKey: event.runId,
        status: event.outcome ?? event.reason,
        payload: tracePayload(services, event, {
          runId: event.runId,
          outcome: event.outcome,
          reason: event.reason,
        }),
      });
    }
  });

  api.on("agent_end", (event, ctx) => {
    finalizeTrace(
      services,
      event.runId ?? ctx.runId,
      event.success ? "completed" : "failed",
      services.traceOptions.captureContent
        ? (event.error ?? "")
        : event.success
          ? ""
          : "Agent failed",
    );
  });

  api.on("session_end", (event) => {
    services.traces.finishSession(
      event.sessionId,
      event.reason === "shutdown" ? "interrupted" : "closed",
    );
  });
}
