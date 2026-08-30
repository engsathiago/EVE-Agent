import { definePluginEntry } from "./api.js";
import { registerAdaptiveRouting } from "./src/adaptive-routing.js";
import { registerIntelligenceCli } from "./src/cli.js";
import { registerIntelligenceGatewayMethods } from "./src/gateway.js";
import { createIntelligenceServices } from "./src/services.js";
import { createIntelligenceTools } from "./src/tools.js";
import { registerTraceHooks } from "./src/trace-hooks.js";

export default definePluginEntry({
  id: "intelligence",
  name: "EVE Intelligence",
  description:
    "Trace Studio, durable workflows, Result Hub, evals, adaptive routing, experiments, and workers.",
  register(api) {
    const services = createIntelligenceServices(api);
    registerAdaptiveRouting(api, services);
    registerTraceHooks(api, services);
    registerIntelligenceGatewayMethods(api, services);
    api.registerTool(() => createIntelligenceTools(services), {
      names: [
        "eve_intelligence_status",
        "eve_trace",
        "eve_result",
        "eve_flow",
        "eve_route",
        "eve_experiment",
        "eve_worker",
        "eve_environment",
        "eve_studio",
        "eve_package",
      ],
      optional: true,
    });
    api.registerCli(async ({ program }) => registerIntelligenceCli(program, services), {
      descriptors: [
        {
          name: "intelligence",
          description: "Show EVE operational intelligence status",
          hasSubcommands: true,
        },
        { name: "traces", description: "Inspect Trace Studio runs", hasSubcommands: true },
        { name: "results", description: "Review Result Hub deliverables", hasSubcommands: true },
        { name: "flows", description: "Manage durable workflows", hasSubcommands: true },
        { name: "evals", description: "Run trajectory-aware evaluations", hasSubcommands: true },
        { name: "router", description: "Inspect adaptive model routing", hasSubcommands: true },
        { name: "experiments", description: "Manage canary experiments", hasSubcommands: true },
        { name: "workers", description: "Manage distributed worker jobs", hasSubcommands: true },
        { name: "model-lab", description: "Manage local model candidates", hasSubcommands: true },
        {
          name: "environments",
          description: "Manage named Docker environments",
          hasSubcommands: true,
        },
        { name: "studio", description: "Manage versioned Studio artifacts", hasSubcommands: true },
        {
          name: "integrations",
          description: "Browse the unified integration catalog",
          hasSubcommands: true,
        },
        {
          name: "packages",
          description: "Manage professional work packages",
          hasSubcommands: true,
        },
      ],
    });
    let sweepTimer: NodeJS.Timeout | undefined;
    let lastTraceSweep = 0;
    api.registerService({
      id: "intelligence-environment-expiry",
      start: () => {
        const sweepTraces = () => {
          services.traces.prune({
            maxAgeDays: services.traceOptions.maxAgeDays,
            keepLatest: services.traceOptions.keepLatest,
            execute: true,
          });
          lastTraceSweep = Date.now();
        };
        sweepTraces();
        sweepTimer = setInterval(() => {
          void services.environments.sweepExpired().catch((error: unknown) => {
            api.logger.warn(`environment expiry sweep failed: ${String(error)}`);
          });
          if (Date.now() - lastTraceSweep >= 60 * 60_000) {
            sweepTraces();
          }
        }, 60_000);
        sweepTimer.unref();
      },
      stop: () => {
        if (sweepTimer) {
          clearInterval(sweepTimer);
        }
        sweepTimer = undefined;
      },
    });
    api.lifecycle.registerRuntimeLifecycle({
      id: "intelligence-database",
      description: "Checkpoint and close the EVE operations database.",
      cleanup: () => services.close(),
    });
  },
});
