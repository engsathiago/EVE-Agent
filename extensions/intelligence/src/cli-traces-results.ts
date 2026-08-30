import type { Command } from "commander";
import { writeValue, type JsonOption } from "./cli-utils.js";
import type { IntelligenceServices } from "./services.js";
import type { EveResultStatus, EveTraceStatus } from "./types.js";

export function registerTraceCommands(program: Command, services: IntelligenceServices): void {
  const traces = program.command("traces").description("Inspect EVE Trace Studio runs");
  traces
    .command("status")
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.traces.status(), options));
  traces
    .command("list")
    .option("--status <status>", "Filter by status")
    .option("--limit <number>", "Maximum runs", "50")
    .option("--json", "Print JSON")
    .action((options: JsonOption & { status?: EveTraceStatus; limit: string }) =>
      writeValue(
        { traces: services.traces.list({ status: options.status, limit: Number(options.limit) }) },
        options,
      ),
    );
  traces
    .command("show")
    .argument("<id>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption) => writeValue(services.traces.get(id), options));
  traces
    .command("replay")
    .argument("<id>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption) => writeValue(services.traces.replay(id), options));
  traces
    .command("prune")
    .option("--days <number>", "Maximum completed trace age", "30")
    .option("--keep <number>", "Always keep latest traces", "5000")
    .option("--execute", "Delete matching traces", false)
    .option("--json", "Print JSON")
    .action((options: JsonOption & { days: string; keep: string; execute: boolean }) =>
      writeValue(
        services.traces.prune({
          maxAgeDays: Number(options.days),
          keepLatest: Number(options.keep),
          execute: options.execute,
        }),
        options,
      ),
    );
}

export function registerResultCommands(program: Command, services: IntelligenceServices): void {
  const results = program
    .command("results")
    .description("Review agent and flow deliverables in Result Hub");
  results
    .command("status")
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.results.status(), options));
  results
    .command("list")
    .option("--status <status>", "Filter by review state")
    .option("--limit <number>", "Maximum items", "100")
    .option("--json", "Print JSON")
    .action((options: JsonOption & { status?: EveResultStatus; limit: string }) =>
      writeValue(
        { items: services.results.list({ status: options.status, limit: Number(options.limit) }) },
        options,
      ),
    );
  results
    .command("show")
    .argument("<id>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption) => writeValue(services.results.get(id), options));
  results
    .command("approve")
    .argument("<id>")
    .option("--note <text>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption & { note?: string }) =>
      writeValue(services.results.updateStatus(id, "approved", options.note), options),
    );
  results
    .command("changes")
    .argument("<id>")
    .requiredOption("--note <text>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption & { note: string }) =>
      writeValue(services.results.updateStatus(id, "changes_requested", options.note), options),
    );
  results
    .command("archive")
    .argument("<id>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption) =>
      writeValue(services.results.updateStatus(id, "archived"), options),
    );
  results
    .command("add-artifact")
    .argument("<id>")
    .argument("<path>")
    .option("--name <name>")
    .option("--json", "Print JSON")
    .action((id: string, filePath: string, options: JsonOption & { name?: string }) =>
      writeValue(services.results.addArtifact(id, filePath, options.name), options),
    );
}
