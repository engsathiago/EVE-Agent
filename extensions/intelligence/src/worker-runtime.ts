import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import os from "node:os";
import type { IntelligenceServices } from "./services.js";
import type { EveWorkerJob, JsonObject } from "./types.js";
import type { WorkerStore } from "./worker-store.js";

const MAX_REQUEST_BYTES = 2_000_000;
// Keep JSON-encoded completion payloads safely below the controller body limit.
const MAX_OUTPUT_BYTES = 900_000;

function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function eveInvocation(): { executable: string; prefix: string[] } {
  const entry = process.argv[1];
  if (entry && /(?:^|[/\\])(?:eve|entry|index)(?:\.m?js)?$/i.test(entry)) {
    return { executable: process.execPath, prefix: [entry] };
  }
  return { executable: "eve", prefix: [] };
}

async function runProcess(input: {
  executable: string;
  args: string[];
  cwd?: string;
  shell?: boolean;
  timeoutMs: number;
}): Promise<JsonObject> {
  return await new Promise((resolve, reject) => {
    const child = spawn(input.executable, input.args, {
      cwd: input.cwd,
      shell: input.shell,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let timedOut = false;
    const append = (target: "stdout" | "stderr", chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        reject(new Error(`worker output exceeded ${MAX_OUTPUT_BYTES} bytes`));
        return;
      }
      if (target === "stdout") {
        stdout += chunk.toString("utf8");
      } else {
        stderr += chunk.toString("utf8");
      }
    };
    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
    child.once("error", reject);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, input.timeoutMs);
    timer.unref();
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`worker process timed out after ${input.timeoutMs} ms`));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `worker process exited with ${code ?? signal}`));
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 0, signal: signal ?? "" });
    });
  });
}

export async function executeWorkerJob(
  job: EveWorkerJob,
  services?: Pick<IntelligenceServices, "flows" | "flowEngine">,
): Promise<JsonObject> {
  const payload = record(job.payload);
  if (job.kind === "flow") {
    if (!services) {
      throw new Error("flow jobs require the EVE intelligence runtime");
    }
    const flow = stringValue(payload.flow).trim();
    if (!flow) {
      throw new Error("flow job requires payload.flow");
    }
    const run = services.flows.start(flow, record(payload.input));
    return { flow: await services.flowEngine.run(run.id) };
  }

  const timeoutMs = Math.min(
    1_740_000,
    Math.max(1_000, numberValue(payload.timeoutMs ?? payload.timeout, 1_740_000)),
  );
  const cwd = stringValue(payload.cwd).trim() || undefined;
  if (job.kind === "eve" || job.kind === "agent") {
    const prompt = stringValue(payload.prompt).trim();
    if (!prompt) {
      throw new Error("agent job requires payload.prompt");
    }
    const invocation = eveInvocation();
    const args = [...invocation.prefix, "agent", "--local", "--message", prompt, "--json"];
    for (const [flag, value] of [
      ["--model", payload.model],
      ["--agent", payload.agent],
      ["--session-key", payload.sessionKey],
    ] as const) {
      const normalized = stringValue(value).trim();
      if (normalized) {
        args.push(flag, normalized);
      }
    }
    return await runProcess({
      executable: invocation.executable,
      args,
      cwd,
      timeoutMs,
    });
  }

  if (job.kind !== "command") {
    throw new Error("worker job kind must be eve, agent, command, or flow");
  }
  const raw = payload.command;
  const command = strings(raw);
  if (command.length > 0) {
    return await runProcess({
      executable: command[0],
      args: command.slice(1),
      cwd,
      timeoutMs,
    });
  }
  const shellCommand = stringValue(raw).trim();
  if (!shellCommand) {
    throw new Error("command job requires payload.command");
  }
  return await runProcess({
    executable: shellCommand,
    args: [],
    cwd,
    shell: true,
    timeoutMs,
  });
}

async function body(request: IncomingMessage): Promise<JsonObject> {
  const length = Number(request.headers["content-length"] ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > MAX_REQUEST_BYTES) {
    throw new Error("request body exceeds the 2 MB limit");
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.byteLength;
    if (received > MAX_REQUEST_BYTES) {
      throw new Error("request body exceeds the 2 MB limit");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  return record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

function reply(response: ServerResponse, status: number, value: unknown): void {
  const output = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(output.byteLength),
    "cache-control": "no-store",
  });
  response.end(output);
}

function bearerToken(request: IncomingMessage): string {
  const value = request.headers.authorization ?? "";
  return value.startsWith("Bearer ") ? value.slice("Bearer ".length) : "";
}

function tokenMatches(request: IncomingMessage, expected: string): boolean {
  if (!expected) {
    return false;
  }
  const received = bearerToken(request);
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export async function startWorkerController(options: {
  workers: WorkerStore;
  host?: string;
  port?: number;
  /** @deprecated Use operatorToken. This alias never authenticates workers. */
  token?: string;
  operatorToken?: string;
  workerTokens?: Record<string, string> | ReadonlyMap<string, string>;
}): Promise<{ server: Server; url: string; close: () => Promise<void> }> {
  const host = options.host?.trim() || "127.0.0.1";
  const port = Math.max(0, Math.trunc(options.port ?? 9121));
  const operatorToken = options.operatorToken?.trim() || options.token?.trim() || "";
  const workerTokens = new Map(
    options.workerTokens instanceof Map
      ? options.workerTokens
      : Object.entries(options.workerTokens ?? {}),
  );
  if (!operatorToken || workerTokens.size === 0) {
    throw new Error("--operator-token and at least one --worker-token <node=token> are required");
  }
  if ([...workerTokens.values()].some((token) => token.trim() === operatorToken)) {
    throw new Error("worker tokens must differ from the operator token");
  }
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url || "/", "http://worker.local");
        if (request.method === "GET" && url.pathname === "/health") {
          reply(response, 200, { ok: true, service: "eve-workers" });
          return;
        }
        if (request.method === "GET" && url.pathname === "/status") {
          if (!tokenMatches(request, operatorToken)) {
            reply(response, 401, { error: "operator_unauthorized" });
            return;
          }
          reply(response, 200, options.workers.status());
          return;
        }
        if (request.method !== "POST") {
          reply(response, 404, { error: "not_found" });
          return;
        }
        const input = await body(request);
        let result: unknown;
        const workerEndpoints = new Set([
          "/register",
          "/heartbeat",
          "/claim",
          "/renew",
          "/complete",
        ]);
        if (workerEndpoints.has(url.pathname)) {
          const nodeId = stringValue(input.id).trim();
          const expectedWorkerToken = workerTokens.get(nodeId)?.trim() ?? "";
          if (!nodeId || !tokenMatches(request, expectedWorkerToken)) {
            reply(response, 401, { error: "worker_unauthorized" });
            return;
          }
        } else if (url.pathname === "/submit") {
          if (!tokenMatches(request, operatorToken)) {
            reply(response, 401, { error: "operator_unauthorized" });
            return;
          }
        }
        if (url.pathname === "/register") {
          result = options.workers.registerNode({
            id: stringValue(input.id),
            name: stringValue(input.name) || undefined,
            endpoint: stringValue(input.endpoint) || undefined,
            labels: strings(input.labels),
            capabilities: strings(input.capabilities),
            maxJobs: numberValue(input.maxJobs ?? input.max_jobs, 1),
            metadata: record(input.metadata),
          });
        } else if (url.pathname === "/heartbeat") {
          result = options.workers.heartbeat(
            stringValue(input.id),
            numberValue(input.activeJobs ?? input.active_jobs, 0),
          );
        } else if (url.pathname === "/claim") {
          result =
            options.workers.claim(
              stringValue(input.id),
              numberValue(input.leaseMs ?? input.lease_ms, 1_800_000),
            ) ?? null;
        } else if (url.pathname === "/renew") {
          result = options.workers.renew(
            stringValue(input.id),
            stringValue(input.jobId ?? input.job_id),
            numberValue(input.attempt, 0),
            numberValue(input.leaseMs ?? input.lease_ms, 1_800_000),
          );
        } else if (url.pathname === "/complete") {
          result = options.workers.complete(
            stringValue(input.id),
            stringValue(input.jobId ?? input.job_id),
            {
              attempt: numberValue(input.attempt, 0),
              result: record(input.result),
              error: stringValue(input.error) || undefined,
            },
          );
        } else if (url.pathname === "/submit") {
          result = options.workers.submit({
            kind: stringValue(input.kind),
            payload: record(input.payload),
            requirements: strings(input.requirements),
            priority: numberValue(input.priority, 0),
            maxAttempts: numberValue(input.maxAttempts ?? input.max_attempts, 3),
          });
        } else {
          reply(response, 404, { error: "not_found" });
          return;
        }
        reply(response, 200, result);
      } catch (error) {
        reply(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
    })();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const publicHost = host === "::1" ? "[::1]" : host === "localhost" ? "127.0.0.1" : host;
  return {
    server,
    url: `http://${publicHost}:${actualPort}`,
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function remoteCall(
  controller: string,
  endpoint: string,
  value: JsonObject,
  token: string,
): Promise<unknown> {
  const response = await fetch(`${controller.replace(/\/$/, "")}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(value),
    signal: AbortSignal.timeout(30_000),
  });
  const result = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(`worker controller HTTP ${response.status}: ${JSON.stringify(result)}`);
  }
  return result;
}

export async function runRemoteWorker(options: {
  controller: string;
  nodeId: string;
  name?: string;
  token?: string;
  labels?: string[];
  capabilities?: string[];
  maxJobs?: number;
  pollMs?: number;
  once?: boolean;
  signal?: AbortSignal;
  services?: Pick<IntelligenceServices, "flows" | "flowEngine">;
  executor?: (job: EveWorkerJob) => Promise<JsonObject>;
}): Promise<EveWorkerJob | null> {
  const token = options.token?.trim() || "";
  const registration: JsonObject = {
    id: options.nodeId,
    name: options.name || options.nodeId,
    labels: options.labels ?? [],
    capabilities: options.capabilities ?? ["eve", "agent", "command"],
    maxJobs: Math.max(1, Math.trunc(options.maxJobs ?? 1)),
    metadata: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
    },
  };
  await remoteCall(options.controller, "/register", registration, token);
  let latest: EveWorkerJob | null = null;
  while (!options.signal?.aborted) {
    const claimed = (await remoteCall(
      options.controller,
      "/claim",
      { id: options.nodeId, leaseMs: 1_800_000 },
      token,
    )) as EveWorkerJob | null;
    if (claimed) {
      const leaseMs = 1_800_000;
      const renewTimer = setInterval(() => {
        void remoteCall(
          options.controller,
          "/renew",
          { id: options.nodeId, jobId: claimed.id, attempt: claimed.attempts, leaseMs },
          token,
        ).catch(() => undefined);
      }, leaseMs / 2);
      try {
        const result = options.executor
          ? await options.executor(claimed)
          : await executeWorkerJob(claimed, options.services);
        latest = (await remoteCall(
          options.controller,
          "/complete",
          { id: options.nodeId, jobId: claimed.id, attempt: claimed.attempts, result },
          token,
        )) as EveWorkerJob;
      } catch (error) {
        latest = (await remoteCall(
          options.controller,
          "/complete",
          {
            id: options.nodeId,
            jobId: claimed.id,
            attempt: claimed.attempts,
            error: error instanceof Error ? error.message : String(error),
          },
          token,
        )) as EveWorkerJob;
      } finally {
        clearInterval(renewTimer);
      }
    } else {
      await remoteCall(
        options.controller,
        "/heartbeat",
        { id: options.nodeId, activeJobs: 0 },
        token,
      );
    }
    if (options.once) {
      return latest;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.max(500, options.pollMs ?? 3_000));
      timer.unref();
      options.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
  return latest;
}
