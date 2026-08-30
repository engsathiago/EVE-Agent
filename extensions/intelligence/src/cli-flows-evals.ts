import type { Command } from "commander";
import {
  parseObject,
  readFlowDefinition,
  writeStarterFlow,
  writeValue,
  type JsonOption,
} from "./cli-utils.js";
import type { IntelligenceServices } from "./services.js";

export function registerFlowCommands(program: Command, services: IntelligenceServices): void {
  const flows = program.command("flows").description("Manage durable EVE workflows");
  flows
    .command("status")
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.flows.status(), options));
  flows
    .command("init")
    .argument("<path>")
    .option("--overwrite", "Replace an existing file", false)
    .option("--json", "Print JSON")
    .action((filePath: string, options: JsonOption & { overwrite: boolean }) =>
      writeValue(writeStarterFlow(filePath, options.overwrite), options),
    );
  flows
    .command("install")
    .argument("<path>")
    .option("--json", "Print JSON")
    .action((filePath: string, options: JsonOption) =>
      writeValue(services.flows.install(readFlowDefinition(filePath)), options),
    );
  flows
    .command("start")
    .argument("<flow>")
    .option("--input <json>", "Flow input JSON", "{}")
    .option("--run", "Execute immediately", false)
    .option("--json", "Print JSON")
    .action(async (flow: string, options: JsonOption & { input: string; run: boolean }) => {
      const started = services.flows.start(flow, parseObject(options.input, "flow input"));
      writeValue(options.run ? await services.flowEngine.run(started.id) : started, options);
    });
  flows
    .command("run")
    .argument("<run-id>")
    .option("--parallel <number>", "Maximum parallel steps", "4")
    .option("--json", "Print JSON")
    .action(async (runId: string, options: JsonOption & { parallel: string }) => {
      const parallel = Number(options.parallel);
      if (!Number.isInteger(parallel) || parallel < 1) {
        throw new Error("--parallel must be a positive integer");
      }
      writeValue(await services.flowEngine.run(runId, { maxParallel: parallel }), options);
    });
  flows
    .command("show")
    .argument("<run-id>")
    .option("--json", "Print JSON")
    .action((runId: string, options: JsonOption) =>
      writeValue(services.flows.getRun(runId), options),
    );
  flows
    .command("resume")
    .argument("<run-id>")
    .option("--step <id>")
    .option("--value <json>", "Resume value as JSON", "null")
    .option("--json", "Print JSON")
    .action(async (runId: string, options: JsonOption & { step?: string; value: string }) =>
      writeValue(
        await services.flowEngine.resume(runId, {
          stepId: options.step,
          value: JSON.parse(options.value),
        }),
        options,
      ),
    );
  flows
    .command("retry")
    .argument("<run-id>")
    .argument("<step-id>")
    .option("--json", "Print JSON")
    .action(async (runId: string, stepId: string, options: JsonOption) =>
      writeValue(await services.flowEngine.retry(runId, stepId), options),
    );
  flows
    .command("fork")
    .argument("<run-id>")
    .argument("<from-step>")
    .option("--json", "Print JSON")
    .action((runId: string, fromStep: string, options: JsonOption) =>
      writeValue(services.flowEngine.fork(runId, fromStep), options),
    );
}

export function registerEvalCommands(program: Command, services: IntelligenceServices): void {
  const evals = program.command("evals").description("Run trajectory-aware EVE evaluations");
  evals
    .command("status")
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.evals.status(), options));
  evals
    .command("init")
    .argument("[name]", "Suite name", "starter")
    .option("--count <number>", "Starter cases", "30")
    .option("--overwrite", "Replace suite", false)
    .option("--json", "Print JSON")
    .action((name: string, options: JsonOption & { count: string; overwrite: boolean }) =>
      writeValue(services.evals.init(name, Number(options.count), options.overwrite), options),
    );
  evals
    .command("run")
    .argument("<suite>")
    .option("--repetitions <number>", "Runs per case", "1")
    .option("--timeout <ms>", "Per-case timeout", "120000")
    .option("--json", "Print JSON")
    .action(async (suite: string, options: JsonOption & { repetitions: string; timeout: string }) =>
      writeValue(
        await services.evals.run(suite, {
          repetitions: Number(options.repetitions),
          timeoutMs: Number(options.timeout),
        }),
        options,
      ),
    );
  evals
    .command("import-traces")
    .argument("[name]", "Suite name", "real-trajectories")
    .option("--limit <number>", "Maximum traces", "50")
    .option("--only-completed", "Exclude failed traces", false)
    .option("--json", "Print JSON")
    .action((name: string, options: JsonOption & { limit: string; onlyCompleted: boolean }) =>
      writeValue(
        services.evals.importTraces(name, Number(options.limit), !options.onlyCompleted),
        options,
      ),
    );
  evals
    .command("compare")
    .argument("<baseline>")
    .argument("<candidate>")
    .option("--max-regression <number>", "Allowed score regression", "0.02")
    .option("--min-improvement <number>", "Required score improvement", "0")
    .option("--json", "Print JSON")
    .action(
      (
        baseline: string,
        candidate: string,
        options: JsonOption & { maxRegression: string; minImprovement: string },
      ) =>
        writeValue(
          services.evals.compare(baseline, candidate, {
            maxRegression: Number(options.maxRegression),
            minImprovement: Number(options.minImprovement),
          }),
          options,
        ),
    );
  evals
    .command("ci")
    .argument("<suite>")
    .option("--min-score <number>", "Minimum accepted score", "0.9")
    .option("--max-latency <ms>")
    .option("--baseline <path>")
    .option("--max-regression <number>", "Allowed regression", "0.02")
    .option("--json", "Print JSON")
    .action(
      async (
        suite: string,
        options: JsonOption & {
          minScore: string;
          maxLatency?: string;
          baseline?: string;
          maxRegression: string;
        },
      ) => {
        const result = await services.evals.ci(suite, {
          minScore: Number(options.minScore),
          maxLatencyMs: options.maxLatency ? Number(options.maxLatency) : undefined,
          baseline: options.baseline,
          maxRegression: Number(options.maxRegression),
        });
        writeValue(result, options);
        if (result.accepted !== true) {
          process.exitCode = 1;
        }
      },
    );
}
