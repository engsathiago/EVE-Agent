import type { Command } from "commander";
import { registerFlowCommands, registerEvalCommands } from "./cli-flows-evals.js";
import { registerModelLabCommands } from "./cli-model-lab.js";
import {
  registerEnvironmentCommands,
  registerIntegrationCommands,
  registerPackageCommands,
  registerStudioCommands,
} from "./cli-product.js";
import { registerRoutingCommands, registerWorkerCommands } from "./cli-routing-workers.js";
import { registerResultCommands, registerTraceCommands } from "./cli-traces-results.js";
import { writeValue, type JsonOption } from "./cli-utils.js";
import type { IntelligenceServices } from "./services.js";

export function registerIntelligenceCli(program: Command, services: IntelligenceServices): void {
  const intelligence = program
    .command("intelligence")
    .description("Show the complete EVE operational intelligence status");
  intelligence
    .command("status", { isDefault: true })
    .option("--json", "Print JSON")
    .action(async (options: JsonOption) => {
      writeValue(
        {
          traces: services.traces.status(),
          results: services.results.status(),
          flows: services.flows.status(),
          router: services.routing.routerStatus(),
          experiments: services.routing.listExperiments(),
          workers: services.workers.status(),
          evals: services.evals.status(),
          modelLab: services.modelLab.status(),
          environments: await services.environments.list(),
          studio: services.studio.list(),
          integrations: services.integrations.list(),
          packages: services.packages.list(),
        },
        options,
      );
    });
  registerTraceCommands(program, services);
  registerResultCommands(program, services);
  registerFlowCommands(program, services);
  registerEvalCommands(program, services);
  registerRoutingCommands(program, services);
  registerWorkerCommands(program, services);
  registerModelLabCommands(program, services);
  registerEnvironmentCommands(program, services);
  registerStudioCommands(program, services);
  registerIntegrationCommands(program, services);
  registerPackageCommands(program, services);
}
