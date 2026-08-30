import type { Command } from "commander";
import { parseObject, writeValue, type JsonOption } from "./cli-utils.js";
import type { IntelligenceServices } from "./services.js";

export function registerModelLabCommands(program: Command, services: IntelligenceServices): void {
  const lab = program
    .command("model-lab")
    .description("Prepare, compare, register, activate, and roll back local models");
  lab
    .command("status")
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.modelLab.status(), options));
  lab
    .command("dataset")
    .argument("<jsonl>")
    .option("--name <name>", "Dataset name", "dataset")
    .option("--json", "Print JSON")
    .action((input: string, options: JsonOption & { name: string }) =>
      writeValue(services.modelLab.prepareDataset(input, options.name), options),
    );
  lab
    .command("compare")
    .argument("<baseline>")
    .argument("<candidate>")
    .requiredOption("--name <name>", "Candidate name")
    .option("--max-regression <number>", "Maximum per-metric regression", "0.02")
    .option("--min-improvement <number>", "Minimum mean improvement", "0")
    .option("--required <json>", "Required metric minimums", "{}")
    .option("--json", "Print JSON")
    .action(
      (
        baseline: string,
        candidate: string,
        options: JsonOption & {
          name: string;
          maxRegression: string;
          minImprovement: string;
          required: string;
        },
      ) =>
        writeValue(
          services.modelLab.compare(baseline, candidate, {
            candidateName: options.name,
            maxRegression: Number(options.maxRegression),
            minImprovement: Number(options.minImprovement),
            required: Object.fromEntries(
              Object.entries(parseObject(options.required, "required metrics")).map(
                ([key, value]) => [key, Number(value)],
              ),
            ),
          }),
          options,
        ),
    );
  lab
    .command("register")
    .argument("<name>")
    .argument("<model-ref>")
    .option("--evaluation <path>")
    .option("--json", "Print JSON")
    .action((name: string, modelRef: string, options: JsonOption & { evaluation?: string }) =>
      writeValue(services.modelLab.register(name, modelRef, options.evaluation), options),
    );
  lab
    .command("activate")
    .argument("<name>")
    .option("--allow-unverified", "Activate without an accepted evaluation", false)
    .option("--json", "Print JSON")
    .action(async (name: string, options: JsonOption & { allowUnverified: boolean }) =>
      writeValue(await services.modelLab.activate(name, options.allowUnverified), options),
    );
  lab
    .command("rollback")
    .option("--json", "Print JSON")
    .action(async (options: JsonOption) => writeValue(await services.modelLab.rollback(), options));
}
