import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestPluginApi } from "eve-agent/plugin-sdk/plugin-test-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIntelligenceServices, type IntelligenceServices } from "./services.js";
import { registerTraceHooks } from "./trace-hooks.js";

const roots: string[] = [];
const servicesToClose: IntelligenceServices[] = [];

afterEach(() => {
  for (const services of servicesToClose.splice(0)) {
    services.close();
  }
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("EVE intelligence trace hooks", () => {
  it("records the selected context budget without requiring content capture", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eve-trace-context-"));
    roots.push(root);
    const on = vi.fn();
    const api = createTestPluginApi({
      source: path.join(process.cwd(), "extensions", "intelligence", "index.ts"),
      rootDir: path.join(process.cwd(), "extensions", "intelligence"),
      pluginConfig: {},
      on,
    });
    const services = createIntelligenceServices(api, path.join(root, "operations.sqlite"));
    servicesToClose.push(services);
    registerTraceHooks(api, services);

    const registration = on.mock.calls.find((call) => call[0] === "model_call_started");
    const handler = registration![1] as (
      event: {
        runId: string;
        callId: string;
        model: string;
        provider: string;
        contextTokenBudget?: number;
        contextWindowSource?: "model" | "modelsConfig" | "agentContextTokens" | "default";
        contextWindowReferenceTokens?: number;
      },
      context: { sessionKey: string; agentId: string },
    ) => void | Promise<void>;
    await handler(
      {
        runId: "run-context",
        callId: "call-context",
        model: "gpt-5.5",
        provider: "openai",
        contextTokenBudget: 96_000,
        contextWindowSource: "agentContextTokens",
        contextWindowReferenceTokens: 128_000,
      },
      { sessionKey: "agent:test", agentId: "test" },
    );

    const trace = services.traces.findByRunKey("run-context")!;
    expect(services.traces.get(trace.id).events).toContainEqual(
      expect.objectContaining({
        eventType: "context_selected",
        spanKey: "call-context",
        payload: {
          contextBudget: 96_000,
          contextUnit: "tokens",
          contextWindowSource: "agentContextTokens",
          contextReference: 128_000,
        },
      }),
    );
  });

  it("does not persist prompt content unless capture is explicitly enabled", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eve-trace-hooks-"));
    roots.push(root);
    const on = vi.fn();
    const api = createTestPluginApi({
      source: path.join(process.cwd(), "extensions", "intelligence", "index.ts"),
      rootDir: path.join(process.cwd(), "extensions", "intelligence"),
      pluginConfig: {},
      on,
    });
    const services = createIntelligenceServices(api, path.join(root, "operations.sqlite"));
    servicesToClose.push(services);
    registerTraceHooks(api, services);
    const registration = on.mock.calls.find((call) => call[0] === "llm_input");
    expect(registration).toBeDefined();
    const handler = registration![1] as (
      event: {
        runId: string;
        sessionId: string;
        model: string;
        provider: string;
        prompt: string;
        historyMessages: unknown[];
        imagesCount: number;
        tools: unknown[];
      },
      context: { sessionKey: string; agentId: string; channel: string },
    ) => void | Promise<void>;
    await handler(
      {
        runId: "run-private",
        sessionId: "session-private",
        model: "test-model",
        provider: "test-provider",
        prompt: "private request token=super-secret-value",
        historyMessages: [],
        imagesCount: 0,
        tools: [],
      },
      { sessionKey: "agent:test", agentId: "test", channel: "test" },
    );

    const outputRegistration = on.mock.calls.find((call) => call[0] === "llm_output");
    const outputHandler = outputRegistration![1] as (event: {
      runId: string;
      model: string;
      provider: string;
      resolvedRef: string;
      usage: Record<string, number>;
      assistantTexts: string[];
    }) => void | Promise<void>;
    await outputHandler({
      runId: "run-private",
      model: "test-model",
      provider: "test-provider",
      resolvedRef: "test-provider/test-model",
      usage: {},
      assistantTexts: ["private assistant response"],
    });
    const toolContext = {
      runId: "run-private",
      sessionId: "session-private",
      sessionKey: "agent:test",
      agentId: "test",
      channelId: "test",
      toolCallId: "tool-private",
    };
    const beforeToolRegistration = on.mock.calls.find((call) => call[0] === "before_tool_call");
    const beforeToolHandler = beforeToolRegistration![1] as (
      event: {
        runId: string;
        toolCallId: string;
        toolName: string;
        params: Record<string, unknown>;
      },
      context: typeof toolContext,
    ) => void | Promise<void>;
    await beforeToolHandler(
      {
        runId: "run-private",
        toolCallId: "tool-private",
        toolName: "write",
        params: { content: "private tool argument" },
      },
      toolContext,
    );
    const afterToolRegistration = on.mock.calls.find((call) => call[0] === "after_tool_call");
    const afterToolHandler = afterToolRegistration![1] as (
      event: {
        runId: string;
        toolCallId: string;
        toolName: string;
        result: Record<string, unknown>;
        error?: string;
        durationMs: number;
      },
      context: typeof toolContext,
    ) => void | Promise<void>;
    await afterToolHandler(
      {
        runId: "run-private",
        toolCallId: "tool-private",
        toolName: "write",
        result: { text: "private tool result" },
        durationMs: 5,
      },
      toolContext,
    );

    const trace = services.traces.findByRunKey("run-private")!;
    const persisted = JSON.stringify(services.traces.get(trace.id));
    expect(persisted).not.toContain("private request");
    expect(persisted).not.toContain("private assistant response");
    expect(persisted).not.toContain("private tool argument");
    expect(persisted).not.toContain("private tool result");
    expect(persisted).not.toContain("super-secret-value");
    expect(trace.metadata).toMatchObject({ promptLength: 40 });
    expect(trace.metadata).not.toHaveProperty("prompt");

    const experiment = services.routing.createExperiment({
      name: "trace-canary",
      kind: "model-routing",
      baseline: "baseline-model",
      candidate: "test-model",
      trafficPercent: 100,
    });
    services.routing.setExperimentStatus(experiment.id, "running");
    const endRegistration = on.mock.calls.find((call) => call[0] === "agent_end");
    const endHandler = endRegistration![1] as (
      event: { runId: string; success: boolean },
      context: { runId: string },
    ) => void | Promise<void>;
    await endHandler({ runId: "run-private", success: true }, { runId: "run-private" });
    expect(services.routing.getExperiment(experiment.id)).toMatchObject({
      candidateRuns: 0,
      candidateScore: 0,
    });
  });
});
