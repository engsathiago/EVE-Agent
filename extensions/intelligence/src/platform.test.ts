import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { runAgentStep, type IntelligenceServices } from "./services.js";
import { StudioStore } from "./studio-store.js";
import { createIntelligenceTools } from "./tools.js";
import { TraceStore } from "./trace-store.js";
import type { EveManagedEnvironment } from "./types.js";
import { WorkPackageStore } from "./work-package-store.js";
import { WorkerStore } from "./worker-store.js";

const cleanup: string[] = [];
const databases: OperationsDatabase[] = [];

function fixture(): { root: string; database: OperationsDatabase } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eve-intelligence-"));
  cleanup.push(root);
  const database = openOperationsDatabase(path.join(root, "operations.sqlite"));
  databases.push(database);
  return { root, database };
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
  for (const root of cleanup.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("EVE operational intelligence", () => {
  it("captures trace lifecycle data and creates versioned review artifacts", () => {
    const { root, database } = fixture();
    const traces = new TraceStore(database);
    const results = new ResultStore(database, path.join(root, "results"));
    const trace = traces.start({
      runKey: "run-1",
      sessionId: "session-1",
      model: "gpt",
      provider: "openai",
      metadata: { prompt: "inspect" },
    });
    traces.recordModelStart(trace.id, "gpt", "openai");
    traces.recordUsage(trace.id, { input: 10, output: 5, cacheRead: 3 });
    traces.recordToolStart(trace.id);
    traces.append(trace.id, {
      eventType: "after_tool_call",
      spanKey: "tool-1",
      status: "completed",
      payload: { toolName: "exec" },
    });
    traces.finish(trace.id, "completed", "done");

    const detail = traces.get(trace.id);
    expect(detail.status).toBe("completed");
    expect(detail.modelCalls).toBe(1);
    expect(detail.toolCalls).toBe(1);
    expect(detail.inputTokens).toBe(10);
    expect(detail.events?.[0]?.eventType).toBe("after_tool_call");
    expect(traces.replay(trace.id).sourceTrace).toBe(trace.id);

    const artifact = path.join(root, "report.txt");
    fs.writeFileSync(artifact, "v1");
    const item = results.create({
      sourceType: "trace",
      sourceId: trace.id,
      title: "Report",
      artifacts: [artifact],
    });
    fs.writeFileSync(artifact, "v2");
    expect(results.addArtifact(item.id, artifact).version).toBe(2);
    expect(results.get(item.id).artifacts?.map((entry) => entry.version)).toEqual([1, 2]);
    expect(results.updateStatus(item.id, "approved").status).toBe("approved");
    expect(() => results.addArtifact(item.id, artifact, "../escaped.txt")).toThrow(
      /single safe filename segment/,
    );
    expect(fs.existsSync(path.join(root, "escaped.txt"))).toBe(false);
  });

  it("pauses, resumes, retries, and forks durable flows", async () => {
    const { root, database } = fixture();
    const flows = new FlowStore(database);
    const results = new ResultStore(database, path.join(root, "results"));
    const engine = new FlowEngine(flows, results);
    flows.install({
      name: "durable-test",
      steps: [
        { id: "prepare", type: "value", value: "ready" },
        { id: "optional", type: "value", needs: ["prepare"], when: false, value: "unused" },
        { id: "approve", type: "wait", needs: ["prepare", "optional"] },
        {
          id: "finish",
          type: "value",
          needs: ["approve"],
          value: "{{steps.approve.output.value}}",
        },
      ],
    });
    const started = flows.start("durable-test", { topic: "x" });
    expect((await engine.run(started.id)).status).toBe("waiting");
    const completed = await engine.resume(started.id, { value: "approved" });
    expect(completed.status).toBe("completed");
    expect(completed.output.finish).toEqual({ value: "approved" });

    const forked = engine.fork(started.id, "finish");
    expect(forked.parentRunId).toBe(started.id);
    expect((await engine.run(forked.id)).status).toBe("completed");
    expect(results.findBySource("flow", started.id)?.status).toBe("ready");
  });

  it("repeats failed flow steps up to their declared retry budget", async () => {
    const { root, database } = fixture();
    const flows = new FlowStore(database);
    const results = new ResultStore(database, path.join(root, "results"));
    const engine = new FlowEngine(flows, results, async (_step, context) => {
      if (context.attempt < 3) {
        throw new Error(`transient attempt ${context.attempt}`);
      }
      return { attempt: context.attempt };
    });
    const definition = flows.install({
      name: "automatic-retry",
      steps: [{ id: "retrying", type: "agent", prompt: "retry", retries: 2 }],
    });
    const completed = await engine.run(flows.start(definition.id).id);
    expect(completed.status).toBe("completed");
    expect(completed.steps[0]).toMatchObject({ attempt: 3, output: { attempt: 3 } });
    expect(() =>
      flows.install({
        name: "invalid-retry",
        steps: [{ id: "bad", type: "value", value: true, retries: -1 }],
      }),
    ).toThrow(/integer from 0 to 100/);
  });

  it("renders input and prior outputs before executing agent flow steps", async () => {
    const { database } = fixture();
    const flows = new FlowStore(database);
    let receivedPrompt = "";
    const engine = new FlowEngine(flows, undefined, async (step) => {
      receivedPrompt = String(step.prompt);
      return { response: receivedPrompt };
    });
    flows.install({
      name: "agent-template-test",
      steps: [
        { id: "prepare", type: "value", value: "ready" },
        {
          id: "agent",
          type: "agent",
          needs: ["prepare"],
          prompt: "{{input.topic}}:{{steps.prepare.output.value}}",
        },
      ],
    });
    const run = flows.start("agent-template-test", { topic: "EVE" });
    expect((await engine.run(run.id)).status).toBe("completed");
    expect(receivedPrompt).toBe("EVE:ready");
  });

  it("returns agent responses and uses a distinct idempotency key for each flow attempt", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ runId: "agent-run-1" })
      .mockResolvedValueOnce({ runId: "agent-run-2" });
    const waitForRun = vi
      .fn()
      .mockResolvedValueOnce({ status: "ok" })
      .mockResolvedValueOnce({ status: "error", error: "provider failed" });
    const getSessionMessages = vi.fn().mockResolvedValue({
      messages: [{ role: "assistant", content: [{ type: "text", text: "completed answer" }] }],
    });
    const api = {
      runtime: { subagent: { run, waitForRun, getSessionMessages } },
    } as unknown as EVEPluginApi;
    const step = { id: "agent", type: "agent", prompt: "work" } as const;
    const baseContext = { runId: "flow-run", input: {}, steps: {} };

    await expect(runAgentStep(api, step, { ...baseContext, attempt: 1 })).resolves.toMatchObject({
      status: "ok",
      response: "completed answer",
    });
    await expect(runAgentStep(api, step, { ...baseContext, attempt: 2 })).rejects.toThrow(
      "provider failed",
    );
    expect(run.mock.calls.map(([options]) => options.idempotencyKey)).toEqual([
      "flow:flow-run:agent:attempt:1",
      "flow:flow-run:agent:attempt:2",
    ]);
    expect(getSessionMessages).toHaveBeenCalledTimes(1);
  });

  it("binds runs and forks to immutable flow definitions", async () => {
    const { database } = fixture();
    const flows = new FlowStore(database);
    const engine = new FlowEngine(flows);
    flows.install({ name: "versioned", steps: [{ id: "value", type: "value", value: "v1" }] });
    const original = flows.start("versioned");
    flows.install({ name: "versioned", steps: [{ id: "value", type: "value", value: "v2" }] });

    expect((await engine.run(original.id)).output.value).toEqual({ value: "v1" });
    expect(original.flowVersion).toBe(1);
    expect(engine.fork(original.id, "value").flowVersion).toBe(1);
    expect((await engine.run(flows.start("versioned").id)).output.value).toEqual({ value: "v2" });
  });

  it("recomputes every transitive dependent when retrying a completed step", async () => {
    const { database } = fixture();
    const flows = new FlowStore(database);
    const engine = new FlowEngine(flows);
    flows.install({
      name: "retry-dependents",
      steps: [
        { id: "root", type: "value", value: "root" },
        { id: "child", type: "value", needs: ["root"], value: "child" },
        { id: "leaf", type: "value", needs: ["child"], value: "leaf" },
        { id: "independent", type: "value", value: "independent" },
      ],
    });
    const run = flows.start("retry-dependents");
    expect((await engine.run(run.id)).status).toBe("completed");
    const retried = await engine.retry(run.id, "root");
    expect(Object.fromEntries(retried.steps.map((step) => [step.stepId, step.attempt]))).toEqual({
      root: 2,
      child: 2,
      leaf: 2,
      independent: 1,
    });
  });

  it("leases a run so concurrent callers cannot duplicate an agent step", async () => {
    const { database } = fixture();
    const flows = new FlowStore(database);
    let executions = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const engine = new FlowEngine(flows, undefined, async () => {
      executions += 1;
      await gate;
      return { ok: true };
    });
    flows.install({ name: "leased", steps: [{ id: "agent", type: "agent", prompt: "work" }] });
    const run = flows.start("leased");
    const first = engine.run(run.id);
    await vi.waitFor(() => expect(executions).toBe(1));
    expect(await engine.run(run.id)).toMatchObject({ status: "running" });
    release?.();
    expect(await first).toMatchObject({ status: "completed" });
    expect(executions).toBe(1);
  });

  it("keeps command flows off the model tool surface while preserving operator execution", async () => {
    const { database } = fixture();
    const flows = new FlowStore(database);
    const installed = flows.install({
      name: "operator-command",
      steps: [{ id: "command", type: "command", command: ["node", "--version"] }],
    });
    const run = flows.start(installed.id);
    expect(() => flows.assertModelRunnableDefinition(installed.id)).toThrow(/operator CLI/);
    expect(() => flows.assertModelRunnableRun(run.id)).toThrow(/operator CLI/);
  });

  it("learns routes and promotes a successful canary", () => {
    const { database } = fixture();
    const routing = new RoutingStore(database);
    for (let index = 0; index < 5; index += 1) {
      routing.record({
        taskKind: "coding",
        model: "strong",
        success: true,
        quality: 1,
        latencyMs: 2000,
        costUsd: 0.01,
        toolSuccess: 1,
      });
      routing.record({
        taskKind: "coding",
        model: "weak",
        success: false,
        quality: 0,
        latencyMs: 1000,
        costUsd: 0.001,
        toolSuccess: 0,
      });
    }
    const decision = routing.recommend(
      "corrija o bug no código",
      [{ model: "weak" }, { model: "strong" }],
      { currentModel: "weak" },
    );
    expect(decision.model).toBe("strong");

    const experiment = routing.createExperiment({
      name: "router-canary",
      kind: "model-routing",
      baseline: "weak",
      candidate: "strong",
      trafficPercent: 10,
      minSamples: 2,
    });
    routing.setExperimentStatus(experiment.id, "running");
    routing.recordExperiment(experiment.id, "baseline", 0);
    routing.recordExperiment(experiment.id, "baseline", 0);
    routing.recordExperiment(experiment.id, "candidate", 1);
    const promoted = routing.recordExperiment(experiment.id, "candidate", 1);
    expect(promoted.decision).toBe("promote");
    expect(promoted.status).toBe("promoted");
    expect(routing.assignExperiment(promoted.id, "stable-key")).toBe("baseline");
  });

  it("leases jobs only to workers with matching capabilities", () => {
    const { database } = fixture();
    const workers = new WorkerStore(database);
    workers.registerNode({ id: "cpu", capabilities: ["command"] });
    workers.registerNode({ id: "gpu", labels: ["gpu"], capabilities: ["command"] });
    const job = workers.submit({
      kind: "command",
      payload: { argv: ["echo", "done"] },
      requirements: ["gpu"],
    });
    expect(workers.claim("cpu")).toBeUndefined();
    const claimed = workers.claim("gpu");
    expect(claimed?.id).toBe(job.id);
    expect(
      workers.complete("gpu", job.id, { attempt: claimed!.attempts, result: { stdout: "done" } })
        .status,
    ).toBe("completed");
    expect(workers.getNode("gpu").activeJobs).toBe(0);
  });

  it("requires a worker capability matching the submitted job kind", () => {
    const { database } = fixture();
    const workers = new WorkerStore(database);
    workers.registerNode({ id: "agent-only", capabilities: ["agent"] });
    const command = workers.submit({ kind: "command" });
    expect(workers.claim("agent-only")).toBeUndefined();
    workers.registerNode({ id: "command", capabilities: ["command"] });
    expect(workers.claim("command")?.id).toBe(command.id);
    expect(() => workers.submit({ kind: "unknown" })).toThrow(/unsupported worker job kind/);
  });

  it("reconciles expired worker leases before enforcing node capacity", () => {
    const { database } = fixture();
    const workers = new WorkerStore(database);
    workers.registerNode({ id: "worker", capabilities: ["command"], maxJobs: 1 });
    const expired = workers.submit({ kind: "command", maxAttempts: 1 });
    expect(workers.claim("worker", 1_000)?.id).toBe(expired.id);
    database.db
      .prepare("UPDATE worker_jobs SET lease_until=? WHERE id=?")
      .run(Date.now() - 1, expired.id);
    const next = workers.submit({ kind: "command" });

    expect(workers.claim("worker")?.id).toBe(next.id);
    expect(workers.getJob(expired.id).status).toBe("failed");
    expect(workers.getNode("worker").activeJobs).toBe(1);
  });

  it("keeps command jobs off the model-facing worker tool", async () => {
    const { database } = fixture();
    const workers = new WorkerStore(database);
    const tool = createIntelligenceTools({ workers } as IntelligenceServices).find(
      (candidate) => candidate.name === "eve_worker",
    )!;
    await expect(
      tool.execute("tool-call", {
        action: "submit",
        kind: "command",
        payload: { command: "echo unsafe" },
      }),
    ).rejects.toThrow(/operator CLI/);
  });

  it("checks output trajectory, latency, cost, and artifacts", () => {
    const { root, database } = fixture();
    const traces = new TraceStore(database);
    const evals = new EvalSuiteService(traces, path.join(root, "evals"));
    const artifact = path.join(root, "artifact.txt");
    fs.writeFileSync(artifact, "ok");
    const response = {
      output: "ok",
      returnCode: 0,
      latencyMs: 1200,
      trace: {
        id: "tr",
        runKey: "run",
        sessionId: "",
        sessionKey: "",
        agentId: "",
        platform: "",
        model: "m1",
        provider: "p1",
        status: "completed" as const,
        startedAt: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        estimatedCostUsd: 0.01,
        modelCalls: 1,
        toolCalls: 1,
        retries: 0,
        errorCount: 0,
        summary: "",
        metadata: {},
        events: [
          {
            id: 1,
            runId: "tr",
            eventType: "after_tool_call",
            spanKey: "",
            parentSpanKey: "",
            occurredAt: 0,
            durationMs: 0,
            status: "completed",
            payload: { toolName: "exec" },
          },
        ],
      },
    };
    for (const check of [
      { type: "tool_called", value: "exec" },
      { type: "max_tool_calls", value: 1 },
      { type: "max_cost_usd", value: 0.02 },
      { type: "trace_status", value: "completed" },
      { type: "artifact_exists", value: artifact },
    ]) {
      expect(evals.check("ok", check, response)[0]).toBe(true);
    }
  });

  it("settles evaluation timeouts even when a child ignores SIGTERM", async () => {
    const { root, database } = fixture();
    const script = path.join(root, "ignore-sigterm.mjs");
    fs.writeFileSync(script, 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);\n');
    const evals = new EvalSuiteService(new TraceStore(database), path.join(root, "evals"));
    const originalScript = process.argv[1];
    process.argv[1] = script;
    try {
      const response = await (
        evals as unknown as {
          defaultRunner: (prompt: string, timeoutMs: number) => Promise<{ returnCode: number }>;
        }
      ).defaultRunner("timeout", 25);
      expect(response.returnCode).toBe(124);
    } finally {
      process.argv[1] = originalScript;
    }
  });

  it("redacts, deduplicates, gates, activates, and rolls back model candidates", async () => {
    const { root } = fixture();
    let runtimeConfig = {
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5.5", fallbacks: ["anthropic/claude-sonnet-4-6"] },
        },
      },
    };
    const configRuntime = {
      current: () => runtimeConfig,
      mutateConfigFile: async (params: {
        mutate: (draft: typeof runtimeConfig) => void | Promise<void>;
      }) => {
        const draft = structuredClone(runtimeConfig);
        await params.mutate(draft);
        runtimeConfig = draft;
        return { previousHash: null, persistedHash: "test", result: undefined };
      },
    } as unknown as EVEPluginApi["runtime"]["config"];
    const lab = new ModelLabService(path.join(root, "model-lab"), configRuntime);
    const source = path.join(root, "source.jsonl");
    const row = {
      input: "email a@b.com",
      output: "token=secret-value",
      apiKey: "ordinary-secret-value",
    };
    fs.writeFileSync(source, `${JSON.stringify(row)}\n${JSON.stringify(row)}\nnot-json\n`);
    const dataset = lab.prepareDataset(source, "training");
    expect(dataset.records).toBe(1);
    expect(dataset.rejected).toBe(2);
    expect(dataset.redactions).toBe(3);
    const preparedDataset = fs.readFileSync(String(dataset.datasetPath), "utf8");
    expect(preparedDataset).not.toContain("secret-value");
    expect(preparedDataset).not.toContain("ordinary-secret-value");

    const baseline = path.join(root, "baseline.json");
    const candidate = path.join(root, "candidate.json");
    fs.writeFileSync(baseline, JSON.stringify({ quality: 0.7, reliability: 0.9 }));
    fs.writeFileSync(candidate, JSON.stringify({ quality: 0.8, reliability: 0.91 }));
    const report = lab.compare(baseline, candidate, {
      candidateName: "eve-local-v2",
      required: { reliability: 0.9 },
    });
    expect(report.decision).toBe("accept");
    lab.register("eve-local-v2", "ollama:eve-v2", String(report.reportPath));
    expect((await lab.activate("eve-local-v2")).active).toBe("eve-local-v2");
    expect(runtimeConfig.agents.defaults.model).toEqual({
      primary: "ollama/eve-v2",
      fallbacks: ["anthropic/claude-sonnet-4-6"],
    });
    expect(lab.status()).toMatchObject({
      runtimeModelRef: "ollama/eve-v2",
      synchronized: true,
    });
    expect((await lab.rollback()).active).toBeNull();
    expect(runtimeConfig.agents.defaults.model.primary).toBe("openai/gpt-5.5");
    lab.register("draft", "ollama:draft");
    await expect(lab.activate("draft")).rejects.toThrow(/has not passed/);
  });

  it("manages Docker environments with quotas, snapshots, expiry, and persistence", async () => {
    const { root, database } = fixture();
    const commands: string[][] = [];
    const manager = new EnvironmentManager(database, {
      root: path.join(root, "environments"),
      limits: { maxRunning: 1, maxTotalCpu: 2, maxTotalMemoryMb: 2048 },
      dockerRunner: async (args) => {
        commands.push(args);
        if (args[0] === "run") {
          return { stdout: "container-1\n" };
        }
        if (args[0] === "inspect") {
          return { stdout: JSON.stringify({ Running: true, ExitCode: 0, Error: "" }) };
        }
        if (args[0] === "version") {
          return { stdout: "28.0.0\n" };
        }
        return { stdout: "" };
      },
    });
    const environment = await manager.create({
      name: "Builder",
      persistent: true,
      network: true,
    });
    expect(environment.status).toBe("running");
    expect(fs.existsSync(environment.workspace)).toBe(true);
    expect(commands[0]).toContain("eve.managed=true");
    await expect(manager.create({ name: "Second" })).rejects.toThrow(/concurrent/);
    expect((await manager.snapshot(environment.id, "golden")).snapshot).toMatchObject({
      image: "eve-snapshot:golden",
    });
    database.db
      .prepare("UPDATE managed_environments SET expires_at=? WHERE id=?")
      .run(Date.now() - 1, environment.id);
    expect((await manager.sweepExpired()).count).toBe(1);
    expect(manager.get(environment.id).status).toBe("expired");
    expect((await manager.remove(environment.id)).workspacePreserved).toBe(true);
  });

  it("preserves active environment quota state on transient Docker inspection errors", async () => {
    const { root, database } = fixture();
    let inspectError = "";
    const manager = new EnvironmentManager(database, {
      root: path.join(root, "environments"),
      limits: { maxRunning: 1 },
      dockerRunner: async (args) => {
        if (args[0] === "run") {
          return { stdout: "container-transient\n" };
        }
        if (args[0] === "inspect") {
          if (inspectError) {
            throw new Error(inspectError);
          }
          return { stdout: JSON.stringify({ Running: true, ExitCode: 0, Error: "" }) };
        }
        if (args[0] === "version") {
          return { stdout: "28.0.0\n" };
        }
        return { stdout: "" };
      },
    });
    const environment = await manager.create({ name: "Transient" });
    inspectError = "Docker daemon temporarily unavailable";
    const listed = (await manager.list()) as { environments: EveManagedEnvironment[] };
    expect(listed.environments[0]).toMatchObject({
      id: environment.id,
      status: "running",
      runtimeError: expect.stringContaining("temporarily unavailable"),
    });
    await expect(manager.create({ name: "Must stay within quota" })).rejects.toThrow(/concurrent/);

    inspectError = "Error: No such container: container-transient";
    const missing = (await manager.list()) as { environments: EveManagedEnvironment[] };
    expect(missing.environments[0]?.status).toBe("missing");
  });

  it("rechecks quotas before starting or restarting an inactive environment", async () => {
    const { root, database } = fixture();
    const states = new Map<string, "running" | "stopped">();
    let sequence = 0;
    const commands: string[][] = [];
    const manager = new EnvironmentManager(database, {
      root: path.join(root, "environments"),
      limits: { maxRunning: 1, maxTotalCpu: 2, maxTotalMemoryMb: 2048 },
      dockerRunner: async (args) => {
        commands.push(args);
        if (args[0] === "run") {
          const id = `container-${++sequence}`;
          states.set(id, "running");
          return { stdout: `${id}\n` };
        }
        const id = args.at(-1) ?? "";
        if (args[0] === "inspect") {
          return {
            stdout: JSON.stringify({
              Running: states.get(id) === "running",
              ExitCode: 0,
              Error: "",
            }),
          };
        }
        if (args[0] === "stop") {
          states.set(id, "stopped");
        } else if (args[0] === "start" || args[0] === "restart") {
          states.set(id, "running");
        }
        return { stdout: "" };
      },
    });

    const first = await manager.create({ name: "First" });
    await manager.control(first.id, "stop");
    await manager.create({ name: "Replacement" });

    await expect(manager.control(first.id, "start")).rejects.toThrow(/concurrent/);
    await expect(manager.control(first.id, "restart")).rejects.toThrow(/concurrent/);
    expect(commands.some((args) => args[0] === "start")).toBe(false);
    expect(commands.some((args) => args[0] === "restart")).toBe(false);
  });

  it("versions Studio files and publishes every revision into Result Hub", () => {
    const { root, database } = fixture();
    const results = new ResultStore(database, path.join(root, "results"));
    const studio = new StudioStore(database, results, path.join(root, "studio"));
    const artifact = studio.create("document", { title: "Architecture" });
    expect(artifact.previewKind).toBe("markdown");
    const changed = studio.save(artifact.id, { content: "# EVE\n\nVersion two.\n" });
    expect(changed.version).toBe(2);
    expect(changed.versions).toHaveLength(1);
    const first = studio.publish(artifact.id) as { result: { artifacts: unknown[] } };
    expect(first.result.artifacts).toHaveLength(1);
    studio.save(artifact.id, { content: "# EVE\n\nVersion three.\n" });
    const second = studio.publish(artifact.id) as { result: { artifacts: unknown[] } };
    expect(second.result.artifacts).toHaveLength(2);
    expect(studio.get(artifact.id, true).content).toContain("Version three");
  });

  it("bounds Studio Gateway imports and content reads to one safe frame", () => {
    const { root, database } = fixture();
    const studio = new StudioStore(database, undefined, path.join(root, "studio"));
    const oversized = Buffer.alloc(16 * 1024 * 1024 + 1).toString("base64");

    expect(() => studio.import({ filename: "large.bin", dataBase64: oversized })).toThrow(
      /limited to 16 MB/,
    );
  });

  it("does not expose unrestricted host-path artifact attachment to models", () => {
    const tool = createIntelligenceTools({} as IntelligenceServices).find(
      (candidate) => candidate.name === "eve_result",
    )!;

    expect(JSON.stringify(tool.parameters)).not.toContain("add_artifact");
  });

  it("installs bundled work packages as native flows and eval suites", () => {
    const { root, database } = fixture();
    const flows = new FlowStore(database);
    const traces = new TraceStore(database);
    const evals = new EvalSuiteService(traces, path.join(root, "evals"));
    const packages = new WorkPackageStore(
      flows,
      evals,
      path.join(import.meta.dirname, "..", "work-packages"),
      root,
    );
    const receipt = packages.install("content") as { name: string; evals: string[] };
    expect(receipt.name).toBe("content");
    expect(receipt.evals).toHaveLength(1);
    expect(flows.getDefinition("content-production").steps[0]?.type).toBe("agent");
    expect((packages.list().installed as unknown[]).length).toBe(1);
    packages.install("content", true);
    expect((packages.list().installed as unknown[]).length).toBe(1);
    expect(fs.existsSync(path.join(root, "packages", "content.previous"))).toBe(false);
  });

  it("removes artifacts retired by a forced work-package replacement", () => {
    const { root, database } = fixture();
    const source = path.join(root, "replacement-package");
    const flows = new FlowStore(database);
    const evals = new EvalSuiteService(new TraceStore(database), path.join(root, "evals-state"));
    const packages = new WorkPackageStore(flows, evals, root, root);
    const writePackage = (flowName: string, evalName: string, skillName: string): void => {
      fs.rmSync(source, { recursive: true, force: true });
      fs.mkdirSync(path.join(source, "flows"), { recursive: true });
      fs.mkdirSync(path.join(source, "evals"), { recursive: true });
      fs.mkdirSync(path.join(source, "skills", skillName), { recursive: true });
      fs.writeFileSync(
        path.join(source, "eve-package.yaml"),
        "name: replacement\nversion: 1.0.0\n",
      );
      fs.writeFileSync(
        path.join(source, "flows", `${flowName}.yaml`),
        `name: ${flowName}\nsteps:\n  - id: output\n    type: value\n    value: ok\n`,
      );
      fs.writeFileSync(
        path.join(source, "evals", `${evalName}.jsonl`),
        `${JSON.stringify({ id: evalName, prompt: "hello", checks: [] })}\n`,
      );
      fs.writeFileSync(path.join(source, "skills", skillName, "SKILL.md"), `# ${skillName}\n`);
    };

    writePackage("retired-flow", "retired", "retired-skill");
    packages.install(source);
    writePackage("current-flow", "current", "current-skill");
    packages.install(source, true);

    expect(() => flows.getDefinition("retired-flow")).toThrow(/flow not found/);
    expect(flows.getDefinition("current-flow").name).toBe("current-flow");
    expect(
      fs.existsSync(path.join(root, "evals-state", "suites", "replacement-retired.jsonl")),
    ).toBe(false);
    expect(fs.existsSync(path.join(root, "skills", "retired-skill"))).toBe(false);
  });

  it("rolls back flow and filesystem changes when package installation fails", () => {
    const { root, database } = fixture();
    const source = path.join(root, "broken-package");
    fs.mkdirSync(path.join(source, "flows"), { recursive: true });
    fs.mkdirSync(path.join(source, "evals"), { recursive: true });
    fs.mkdirSync(path.join(source, "skills", "demo"), { recursive: true });
    fs.writeFileSync(
      path.join(source, "eve-package.yaml"),
      "name: broken\nversion: 1.0.0\ndescription: rollback fixture\n",
    );
    for (const name of ["one", "two"]) {
      fs.writeFileSync(
        path.join(source, "flows", `${name}.yaml`),
        `name: ${name}\nsteps:\n  - id: output\n    type: value\n    value: ok\n`,
      );
    }
    fs.writeFileSync(
      path.join(source, "evals", "suite.jsonl"),
      `${JSON.stringify({ id: "case", prompt: "hello", checks: [] })}\n`,
    );
    fs.writeFileSync(path.join(source, "skills", "demo", "SKILL.md"), "# new skill\n");

    const flows = new FlowStore(database);
    const originalInstall = flows.install.bind(flows);
    let calls = 0;
    flows.install = (definition) => {
      calls += 1;
      if (calls === 2) {
        throw new Error("simulated package failure");
      }
      return originalInstall(definition);
    };
    const evals = new EvalSuiteService(new TraceStore(database), path.join(root, "evals-state"));
    const packages = new WorkPackageStore(flows, evals, root, root);
    const previousTarget = path.join(root, "packages", "broken");
    const previousSkill = path.join(root, "skills", "demo");
    const previousEval = path.join(root, "evals-state", "suites", "broken-suite.jsonl");
    fs.mkdirSync(previousTarget, { recursive: true });
    fs.writeFileSync(path.join(previousTarget, "sentinel"), "old package\n");
    fs.mkdirSync(previousSkill, { recursive: true });
    fs.writeFileSync(path.join(previousSkill, "SKILL.md"), "# old skill\n");
    fs.mkdirSync(path.dirname(previousEval), { recursive: true });
    fs.writeFileSync(previousEval, "old eval\n");

    expect(() => packages.install(source, true)).toThrow("simulated package failure");
    expect(flows.listDefinitions()).toEqual([]);
    expect(fs.readFileSync(path.join(previousTarget, "sentinel"), "utf8")).toBe("old package\n");
    expect(fs.readFileSync(path.join(previousSkill, "SKILL.md"), "utf8")).toBe("# old skill\n");
    expect(fs.readFileSync(previousEval, "utf8")).toBe("old eval\n");
  });

  it.skipIf(process.platform === "win32")(
    "rejects symbolic links anywhere in a work package",
    () => {
      const { root, database } = fixture();
      const source = path.join(root, "linked-package");
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, "eve-package.yaml"), "name: linked\nversion: 1.0.0\n");
      const outside = path.join(root, "outside-secret.txt");
      fs.writeFileSync(outside, "must-not-be-copied\n");
      fs.symlinkSync(outside, path.join(source, "linked-secret.txt"));
      const packages = new WorkPackageStore(
        new FlowStore(database),
        new EvalSuiteService(new TraceStore(database), path.join(root, "evals-state")),
        root,
        root,
      );

      expect(() => packages.install(source)).toThrow(/symbolic links are not allowed/);
      expect(fs.existsSync(path.join(root, "packages", "linked"))).toBe(false);
    },
  );

  it("unifies plugin, channel, and MCP state without exposing credentials", () => {
    const { root } = fixture();
    const pluginRoot = path.join(root, "extensions", "chat");
    fs.mkdirSync(pluginRoot, { recursive: true });
    fs.writeFileSync(
      path.join(pluginRoot, "eve.plugin.json"),
      JSON.stringify({
        id: "chat",
        name: "Chat",
        description: "Chat integration",
        channels: ["chat"],
        channelEnvVars: { chat: ["CHAT_TOKEN"] },
      }),
    );
    const api = {
      config: {
        plugins: { entries: { chat: { enabled: true } } },
        channels: { chat: { enabled: true, token: "do-not-return" } },
        mcp: {
          servers: {
            docs: {
              url: "https://example.test/mcp?token=do-not-return",
              headers: { Authorization: "Bearer do-not-return" },
            },
          },
        },
      },
    } as unknown as EVEPluginApi;
    const catalog = new IntegrationCatalog(api, path.join(root, "extensions")).list();
    expect(catalog.counts).toMatchObject({ total: 9, installed: 3, enabled: 3 });
    expect(catalog.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "mcp:figma", installed: false, authType: "oauth" }),
        expect.objectContaining({ id: "mcp:docs", installed: true, enabled: true }),
      ]),
    );
    expect(JSON.stringify(catalog)).not.toContain("do-not-return");
  });
});
