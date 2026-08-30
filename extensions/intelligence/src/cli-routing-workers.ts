import type { Command } from "commander";
import { collect, parseObject, parseStringList, writeValue, type JsonOption } from "./cli-utils.js";
import type { IntelligenceServices } from "./services.js";
import type { EveRouteCandidate, EveWorkerJob } from "./types.js";
import { runRemoteWorker, startWorkerController } from "./worker-runtime.js";

function parseCandidate(value: string): EveRouteCandidate {
  const separator = value.indexOf("/");
  return separator > 0
    ? { provider: value.slice(0, separator), model: value.slice(separator + 1) }
    : { model: value };
}

function parseWorkerTokens(values: string[], envValue?: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const entries = [...(envValue ? envValue.split(",") : []), ...values];
  for (const entry of entries) {
    const separator = entry.indexOf("=");
    const nodeId = separator > 0 ? entry.slice(0, separator).trim() : "";
    const token = separator > 0 ? entry.slice(separator + 1).trim() : "";
    if (!nodeId || !token) {
      throw new Error("worker tokens must use <node-id>=<token>");
    }
    tokens[nodeId] = token;
  }
  return tokens;
}

export function registerRoutingCommands(program: Command, services: IntelligenceServices): void {
  const router = program.command("router").description("Inspect evidence-driven model routing");
  router
    .command("status")
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.routing.routerStatus(), options));
  router
    .command("recommend")
    .argument("<prompt>")
    .option("--candidate <provider/model>", "Routing candidate; repeat for multiple", collect, [])
    .option("--model <model>", "Current model")
    .option("--provider <provider>", "Current provider")
    .option("--json", "Print JSON")
    .action(
      (
        prompt: string,
        options: JsonOption & { candidate: string[]; model?: string; provider?: string },
      ) => {
        const candidates =
          options.candidate.length > 0
            ? options.candidate.map(parseCandidate)
            : options.model
              ? [{ model: options.model, provider: options.provider }]
              : [];
        writeValue(
          services.routing.recommend(prompt, candidates, {
            currentModel: options.model,
            currentProvider: options.provider,
          }),
          options,
        );
      },
    );
  router
    .command("record")
    .requiredOption("--task <kind>")
    .requiredOption("--model <model>")
    .option("--provider <provider>")
    .option("--success", "Record success", false)
    .option("--quality <number>", "Quality from 0 to 1")
    .option("--latency <ms>", "Latency in milliseconds")
    .option("--cost <usd>", "Estimated cost")
    .option("--tool-success <number>", "Tool success from 0 to 1")
    .option("--json", "Print JSON")
    .action(
      (
        options: JsonOption & {
          task: string;
          model: string;
          provider?: string;
          success: boolean;
          quality?: string;
          latency?: string;
          cost?: string;
          toolSuccess?: string;
        },
      ) => {
        services.routing.record({
          taskKind: options.task,
          model: options.model,
          provider: options.provider,
          success: options.success,
          quality: options.quality ? Number(options.quality) : undefined,
          latencyMs: options.latency ? Number(options.latency) : undefined,
          costUsd: options.cost ? Number(options.cost) : undefined,
          toolSuccess: options.toolSuccess ? Number(options.toolSuccess) : undefined,
        });
        writeValue({ recorded: true }, options);
      },
    );

  const experiments = program
    .command("experiments")
    .description("Manage deterministic canary experiments");
  experiments
    .command("status")
    .argument("[id-or-name]")
    .option("--json", "Print JSON")
    .action((id: string | undefined, options: JsonOption) =>
      writeValue(
        id
          ? services.routing.getExperiment(id)
          : { experiments: services.routing.listExperiments() },
        options,
      ),
    );
  experiments
    .command("create")
    .argument("<name>")
    .requiredOption("--kind <kind>")
    .requiredOption("--baseline <value>")
    .requiredOption("--candidate <value>")
    .option("--traffic <percent>", "Candidate traffic percent", "5")
    .option("--min-samples <number>", "Samples required per arm", "20")
    .option("--max-regression <number>", "Allowed regression", "0.02")
    .option("--json", "Print JSON")
    .action(
      (
        name: string,
        options: JsonOption & {
          kind: string;
          baseline: string;
          candidate: string;
          traffic: string;
          minSamples: string;
          maxRegression: string;
        },
      ) =>
        writeValue(
          services.routing.createExperiment({
            name,
            kind: options.kind,
            baseline: options.baseline,
            candidate: options.candidate,
            trafficPercent: Number(options.traffic),
            minSamples: Number(options.minSamples),
            maxRegression: Number(options.maxRegression),
          }),
          options,
        ),
    );
  experiments
    .command("start")
    .argument("<id-or-name>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption) =>
      writeValue(services.routing.setExperimentStatus(id, "running"), options),
    );
  experiments
    .command("stop")
    .argument("<id-or-name>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption) =>
      writeValue(services.routing.setExperimentStatus(id, "stopped"), options),
    );
  experiments
    .command("assign")
    .argument("<id-or-name>")
    .argument("<key>")
    .option("--json", "Print JSON")
    .action((id: string, key: string, options: JsonOption) =>
      writeValue({ arm: services.routing.assignExperiment(id, key) }, options),
    );
  experiments
    .command("record")
    .argument("<id-or-name>")
    .argument("<arm>", "baseline or candidate")
    .argument("<score>")
    .option("--json", "Print JSON")
    .action((id: string, arm: "baseline" | "candidate", score: string, options: JsonOption) => {
      if (arm !== "baseline" && arm !== "candidate") {
        throw new Error("arm must be baseline or candidate");
      }
      writeValue(services.routing.recordExperiment(id, arm, Number(score)), options);
    });
}

export function registerWorkerCommands(program: Command, services: IntelligenceServices): void {
  const workers = program.command("workers").description("Manage the EVE distributed worker queue");
  workers
    .command("status")
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.workers.status(), options));
  workers
    .command("register")
    .argument("<id>")
    .option("--name <name>")
    .option("--endpoint <url>")
    .option("--labels <items>", "Comma-separated labels")
    .option("--capabilities <items>", "Comma-separated capabilities")
    .option("--max-jobs <number>", "Concurrent leases", "1")
    .option("--json", "Print JSON")
    .action(
      (
        id: string,
        options: JsonOption & {
          name?: string;
          endpoint?: string;
          labels?: string;
          capabilities?: string;
          maxJobs: string;
        },
      ) =>
        writeValue(
          services.workers.registerNode({
            id,
            name: options.name,
            endpoint: options.endpoint,
            labels: parseStringList(options.labels),
            capabilities: parseStringList(options.capabilities),
            maxJobs: Number(options.maxJobs),
          }),
          options,
        ),
    );
  workers
    .command("heartbeat")
    .argument("<id>")
    .option("--active <number>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption & { active?: string }) =>
      writeValue(
        services.workers.heartbeat(id, options.active ? Number(options.active) : undefined),
        options,
      ),
    );
  workers
    .command("submit")
    .argument("<kind>")
    .argument("[payload]", "JSON object", "{}")
    .option("--requirements <items>", "Comma-separated requirements")
    .option("--priority <number>", "Queue priority", "0")
    .option("--max-attempts <number>", "Maximum leases", "3")
    .option("--json", "Print JSON")
    .action(
      (
        kind: string,
        payload: string,
        options: JsonOption & { requirements?: string; priority: string; maxAttempts: string },
      ) =>
        writeValue(
          services.workers.submit({
            kind,
            payload: parseObject(payload, "job payload"),
            requirements: parseStringList(options.requirements),
            priority: Number(options.priority),
            maxAttempts: Number(options.maxAttempts),
          }),
          options,
        ),
    );
  workers
    .command("claim")
    .argument("<node-id>")
    .option("--lease <ms>", "Lease duration", "900000")
    .option("--json", "Print JSON")
    .action((nodeId: string, options: JsonOption & { lease: string }) =>
      writeValue({ job: services.workers.claim(nodeId, Number(options.lease)) ?? null }, options),
    );
  workers
    .command("complete")
    .argument("<node-id>")
    .argument("<job-id>")
    .requiredOption("--attempt <n>", "Lease attempt returned by claim")
    .option("--result <json>", "Result object", "{}")
    .option("--error <text>")
    .option("--json", "Print JSON")
    .action(
      (
        nodeId: string,
        jobId: string,
        options: JsonOption & { result: string; error?: string; attempt: string },
      ) =>
        writeValue(
          services.workers.complete(nodeId, jobId, {
            attempt: Number(options.attempt),
            result: parseObject(options.result, "job result"),
            error: options.error,
          }),
          options,
        ),
    );
  workers
    .command("jobs")
    .option("--status <status>")
    .option("--limit <number>", "Maximum jobs", "100")
    .option("--json", "Print JSON")
    .action((options: JsonOption & { status?: EveWorkerJob["status"]; limit: string }) =>
      writeValue(
        {
          jobs: services.workers.listJobs({ status: options.status, limit: Number(options.limit) }),
        },
        options,
      ),
    );
  workers
    .command("serve")
    .description("Serve the authenticated pull-based worker controller")
    .option("--bind <host>", "Listen address", "127.0.0.1")
    .option("--port <number>", "Listen port", "9121")
    .option("--operator-token <token>", "Operator bearer token")
    .option("--worker-token <node=token>", "Per-node worker token; repeat per node", collect, [])
    .option("--token <token>", "Deprecated alias for --operator-token")
    .option("--json", "Print JSON")
    .action(
      async (
        options: JsonOption & {
          bind: string;
          port: string;
          token?: string;
          operatorToken?: string;
          workerToken: string[];
        },
      ) => {
        const controller = await startWorkerController({
          workers: services.workers,
          host: options.bind,
          port: Number(options.port),
          operatorToken:
            options.operatorToken ??
            options.token ??
            process.env.EVE_WORKER_OPERATOR_TOKEN ??
            process.env.EVE_WORKER_TOKEN,
          workerTokens: parseWorkerTokens(options.workerToken, process.env.EVE_WORKER_TOKENS),
        });
        writeValue({ listening: true, url: controller.url }, options);
        const abort = new AbortController();
        const stop = () => abort.abort();
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        await new Promise<void>((resolve) => {
          abort.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        await controller.close();
      },
    );
  workers
    .command("run")
    .description("Run this machine as a pull-based EVE worker")
    .requiredOption("--controller <url>")
    .requiredOption("--id <node-id>")
    .option("--name <name>")
    .option("--token <token>")
    .option("--labels <items>", "Comma-separated labels")
    .option("--capabilities <items>", "Comma-separated capabilities")
    .option("--max-jobs <number>", "Advertised capacity", "1")
    .option("--poll <ms>", "Polling interval", "3000")
    .option("--once", "Claim at most one job and exit", false)
    .option("--json", "Print JSON")
    .action(
      async (
        options: JsonOption & {
          controller: string;
          id: string;
          name?: string;
          token?: string;
          labels?: string;
          capabilities?: string;
          maxJobs: string;
          poll: string;
          once: boolean;
        },
      ) => {
        const abort = new AbortController();
        const stop = () => abort.abort();
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        const result = await runRemoteWorker({
          controller: options.controller,
          nodeId: options.id,
          name: options.name,
          token: options.token ?? process.env.EVE_WORKER_TOKEN,
          labels: parseStringList(options.labels),
          ...(options.capabilities ? { capabilities: parseStringList(options.capabilities) } : {}),
          maxJobs: Number(options.maxJobs),
          pollMs: Number(options.poll),
          once: options.once,
          signal: abort.signal,
          services,
        });
        writeValue({ worker: options.id, latest: result }, options);
      },
    );
}
