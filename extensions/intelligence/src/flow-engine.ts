import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { FlowStore } from "./flow-store.js";
import type { ResultStore } from "./result-store.js";
import type { EveFlowRun, EveFlowStepDefinition, JsonObject } from "./types.js";

export type FlowStepExecutionContext = {
  runId: string;
  attempt: number;
  input: JsonObject;
  steps: Record<string, { output: JsonObject }>;
};

export type FlowAgentExecutor = (
  step: EveFlowStepDefinition,
  context: FlowStepExecutionContext,
  signal: AbortSignal,
) => Promise<JsonObject>;

const terminal = new Set(["completed", "failed", "skipped"]);
const dependencySatisfied = new Set(["completed", "skipped"]);
const templatePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
const RUN_LEASE_MS = 60_000;
const RUN_LEASE_RENEW_MS = 20_000;
const COMMAND_OUTPUT_LIMIT = 1_000_000;

function lookup(context: unknown, dotted: string): unknown {
  let current = context;
  for (const key of dotted.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function render(value: unknown, context: FlowStepExecutionContext): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (exact) {
      return lookup(context, exact[1]);
    }
    return value.replace(templatePattern, (_match, expression: string) => {
      const resolved = lookup(context, expression.trim());
      return resolved === undefined || resolved === null
        ? ""
        : typeof resolved === "string"
          ? resolved
          : JSON.stringify(resolved);
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => render(item, context));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        render(item, context),
      ]),
    );
  }
  return value;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : { value };
}

function conditionMet(condition: unknown, context: FlowStepExecutionContext): boolean {
  if (condition === undefined) {
    return true;
  }
  const rendered = render(condition, context);
  if (typeof rendered === "string") {
    return !["", "0", "false", "no", "null", "undefined"].includes(rendered.trim().toLowerCase());
  }
  return Boolean(rendered);
}

async function runCommand(
  step: EveFlowStepDefinition,
  context: FlowStepExecutionContext,
  signal?: AbortSignal,
): Promise<JsonObject> {
  const rendered = render(step.command, context);
  const commandPart = (value: unknown): string => {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
    if (value === null || value === undefined) {
      return "";
    }
    return JSON.stringify(value) ?? "";
  };
  const command = Array.isArray(rendered) ? rendered.map(commandPart) : commandPart(rendered);
  if ((Array.isArray(command) && command.length === 0) || command === "") {
    throw new Error(`command step ${step.id} has no command`);
  }
  return await new Promise<JsonObject>((resolve, reject) => {
    const child = Array.isArray(command)
      ? spawn(command[0], command.slice(1), { cwd: step.cwd, shell: false })
      : spawn(command, { cwd: step.cwd, shell: true });
    const abort = (): void => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    };
    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener("abort", abort, { once: true });
    }
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    const collect = (target: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.length;
      if (outputBytes > COMMAND_OUTPUT_LIMIT) {
        abort();
        return;
      }
      target.push(chunk);
    };
    child.stdout?.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr?.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", reject);
    child.once("close", (code, closeSignal) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new Error("flow lease renewal was lost"));
        return;
      }
      if (outputBytes > COMMAND_OUTPUT_LIMIT) {
        reject(new Error(`command output exceeded ${COMMAND_OUTPUT_LIMIT} bytes`));
        return;
      }
      const output = Buffer.concat(stdout).toString("utf8").slice(0, 1_000_000);
      const errorOutput = Buffer.concat(stderr).toString("utf8").slice(0, 1_000_000);
      if (code !== 0) {
        reject(
          new Error(`command exited with ${code ?? closeSignal ?? "unknown"}: ${errorOutput}`),
        );
        return;
      }
      resolve({ stdout: output, stderr: errorOutput, exitCode: code ?? 0 });
    });
  });
}

export class FlowEngine {
  constructor(
    private readonly store: FlowStore,
    private readonly resultStore?: ResultStore,
    private readonly agentExecutor?: FlowAgentExecutor,
  ) {}

  private context(run: EveFlowRun): FlowStepExecutionContext {
    return {
      runId: run.id,
      attempt: 0,
      input: run.input,
      steps: Object.fromEntries(run.steps.map((step) => [step.stepId, { output: step.output }])),
    };
  }

  private async executeStep(
    step: EveFlowStepDefinition,
    context: FlowStepExecutionContext,
    signal?: AbortSignal,
  ): Promise<{ status: "completed" | "waiting"; output: JsonObject }> {
    const renderedStep = render(step, context) as EveFlowStepDefinition;
    if (step.type === "wait") {
      return {
        status: "waiting",
        output: {
          waiting: true,
          message: renderedStep.metadata?.message ?? renderedStep.value ?? "",
        },
      };
    }
    if (step.type === "value") {
      return { status: "completed", output: asObject(renderedStep.value) };
    }
    if (step.type === "command") {
      return { status: "completed", output: await runCommand(renderedStep, context, signal) };
    }
    if (!this.agentExecutor) {
      throw new Error("agent flow steps require a running EVE Gateway");
    }
    return {
      status: "completed",
      output: await this.agentExecutor(
        renderedStep,
        context,
        signal ?? new AbortController().signal,
      ),
    };
  }

  async run(runId: string, options: { maxParallel?: number } = {}): Promise<EveFlowRun> {
    return await this.withRunLease(
      runId,
      async (signal) => await this.runLeased(runId, { ...options, signal }),
    );
  }

  private async withRunLease(
    runId: string,
    operation: (signal: AbortSignal) => Promise<EveFlowRun>,
  ): Promise<EveFlowRun> {
    // A database-backed lease prevents concurrent callers and separate Gateway
    // processes from executing the same durable side effect twice.
    const ownerId = `flow_exec_${randomUUID()}`;
    if (!this.store.acquireRunLease(runId, ownerId, RUN_LEASE_MS)) {
      return this.store.getRun(runId);
    }
    const abort = new AbortController();
    const renew = setInterval(() => {
      try {
        if (!this.store.renewRunLease(runId, ownerId, RUN_LEASE_MS)) {
          abort.abort(new Error("flow lease renewal was lost"));
        }
      } catch (error) {
        abort.abort(error);
      }
    }, RUN_LEASE_RENEW_MS);
    renew.unref();
    try {
      return await operation(abort.signal);
    } finally {
      clearInterval(renew);
      this.store.releaseRunLease(runId, ownerId);
    }
  }

  private async runLeased(
    runId: string,
    options: { maxParallel?: number; signal?: AbortSignal },
  ): Promise<EveFlowRun> {
    const definition = this.store.getDefinitionForRun(runId);
    const byId = new Map(definition.steps.map((step) => [step.id, step]));
    const maxParallel = Math.max(1, Math.min(32, Math.trunc(options.maxParallel ?? 4)));
    this.store.setRunStatus(runId, "running");

    // A newly acquired lease means no prior executor owns these persisted
    // running steps. Fail them into the normal retry path instead of leaving
    // a durable run permanently blocked after a process loss.
    for (const step of this.store.getRun(runId).steps) {
      if (step.status === "running") {
        this.store.finishStep(runId, step.stepId, "failed", {}, "step interrupted by lease loss");
      }
    }

    while (true) {
      if (options.signal?.aborted) {
        this.finish(runId, "failed", {}, "flow lease renewal was lost");
        return this.store.getRun(runId);
      }
      const run = this.store.getRun(runId);
      const failed = run.steps.find((step) => step.status === "failed");
      if (failed) {
        const retries = byId.get(failed.stepId)?.retries ?? 0;
        if (failed.attempt <= retries) {
          this.store.resetStep(runId, failed.stepId);
          continue;
        }
        this.finish(runId, "failed", {}, failed.error || `step failed: ${failed.stepId}`);
        return this.store.getRun(runId);
      }
      if (run.steps.every((step) => terminal.has(step.status))) {
        const output = Object.fromEntries(run.steps.map((step) => [step.stepId, step.output]));
        this.finish(runId, "completed", output);
        return this.store.getRun(runId);
      }
      if (run.steps.some((step) => step.status === "waiting")) {
        this.store.setRunStatus(runId, "waiting");
        return this.store.getRun(runId);
      }

      const state = new Map(run.steps.map((step) => [step.stepId, step.status]));
      const context = this.context(run);
      const runnable = definition.steps.filter((step) => {
        if (state.get(step.id) !== "pending") {
          return false;
        }
        return (step.needs ?? []).every((dependency) =>
          dependencySatisfied.has(state.get(dependency) ?? ""),
        );
      });
      if (runnable.length === 0) {
        if (run.steps.some((step) => step.status === "running")) {
          return run;
        }
        this.finish(runId, "failed", {}, "flow has no runnable steps");
        return this.store.getRun(runId);
      }

      const batch = runnable.slice(0, maxParallel);
      await Promise.all(
        batch.map(async (step) => {
          if (!conditionMet(step.when, context)) {
            this.store.finishStep(runId, step.id, "skipped", { skipped: true });
            return;
          }
          const rendered = asObject(render(step, context));
          const attempt = this.store.startStep(runId, step.id, rendered);
          if (attempt === undefined) {
            return;
          }
          try {
            const result = await this.executeStep(
              byId.get(step.id)!,
              { ...context, attempt },
              options.signal,
            );
            if (options.signal?.aborted) {
              return;
            }
            this.store.finishStep(runId, step.id, result.status, result.output);
          } catch (error) {
            this.store.finishStep(runId, step.id, "failed", {}, String(error));
          }
        }),
      );
    }
  }

  async resume(
    runId: string,
    options: { stepId?: string; value?: unknown; maxParallel?: number } = {},
  ): Promise<EveFlowRun> {
    const waiting = this.store
      .getRun(runId)
      .steps.filter(
        (step) => step.status === "waiting" && (!options.stepId || step.stepId === options.stepId),
      );
    if (waiting.length === 0) {
      throw new Error("flow has no matching waiting step");
    }
    for (const step of waiting) {
      this.store.resumeStep(runId, step.stepId, options.value);
    }
    return await this.run(runId, { maxParallel: options.maxParallel });
  }

  async retry(runId: string, stepId: string): Promise<EveFlowRun> {
    return await this.withRunLease(runId, async () => {
      const definition = this.store.getDefinitionForRun(runId);
      if (!definition.steps.some((step) => step.id === stepId)) {
        throw new Error(`unknown flow step: ${stepId}`);
      }
      const reset = new Set([stepId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const step of definition.steps) {
          if (
            !reset.has(step.id) &&
            (step.needs ?? []).some((dependency) => reset.has(dependency))
          ) {
            reset.add(step.id);
            changed = true;
          }
        }
      }
      this.store.resetSteps(runId, [...reset]);
      return await this.runLeased(runId, {});
    });
  }

  fork(runId: string, fromStep: string): EveFlowRun {
    const source = this.store.getRun(runId);
    const definition = this.store.getDefinitionForRun(runId);
    const cutoff = definition.steps.findIndex((step) => step.id === fromStep);
    if (cutoff < 0) {
      throw new Error(`unknown flow step: ${fromStep}`);
    }
    const child = this.store.startFromRun(runId, source.input, runId);
    for (const step of definition.steps.slice(0, cutoff)) {
      const prior = source.steps.find((item) => item.stepId === step.id);
      if (prior && terminal.has(prior.status)) {
        this.store.copyStep(runId, child.id, step.id);
      }
    }
    return this.store.getRun(child.id);
  }

  private finish(
    runId: string,
    status: "completed" | "failed",
    output: JsonObject,
    error = "",
  ): void {
    this.store.setRunStatus(runId, status, output, error);
    this.resultStore?.create({
      sourceType: "flow",
      sourceId: runId,
      title: `Flow ${this.store.getRun(runId).flowName}`,
      summary: error || `Flow finished as ${status}`,
      status: status === "completed" ? "ready" : "failed",
      metadata: { flowRunId: runId, status },
    });
  }
}
