// Offline installation and local-model readiness command registration.
import type { Command } from "commander";
import { formatDocsLink } from "../../../packages/terminal-core/src/links.js";
import { theme } from "../../../packages/terminal-core/src/theme.js";
import {
  offlineBundleCommand,
  offlineConfigureCommand,
  offlineStatusCommand,
} from "../../commands/offline.js";
import { defaultRuntime } from "../../runtime.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";

/** Register commands for creating and inspecting network-free EVE installations. */
export function registerOfflineCommand(program: Command) {
  const offline = program
    .command("offline")
    .description("Prepare network-free EVE installations and inspect local-model readiness")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/offline", "docs.eve.ai/cli/offline")}\n`,
    );

  offline
    .command("status")
    .description("Check Node.js, platform, Ollama connectivity, and available local models")
    .option("--base-url <url>", "Ollama base URL", "http://127.0.0.1:11434")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await offlineStatusCommand(defaultRuntime, {
          baseUrl: opts.baseUrl as string,
          json: Boolean(opts.json),
        });
      });
    });

  offline
    .command("bundle")
    .description("Create a checksummed EVE package and dependency cache for offline installation")
    .requiredOption("--output <directory>", "Empty output directory outside the source tree")
    .option("--skip-build", "Package the current build without rebuilding first", false)
    .option("--include-models", "Bundle the local Ollama model store", false)
    .option("--ollama-models <path>", "Override the Ollama model-store path")
    .option("--include-ollama", "Bundle an Ollama executable", false)
    .option("--ollama-binary <path>", "Path to the Ollama executable")
    .option("--json", "Output JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          [
            "eve offline bundle --output /Volumes/USB/eve-offline",
            "Build a portable bundle with EVE and its complete npm dependency cache.",
          ],
          [
            "eve offline bundle --output /Volumes/USB/eve-full --include-models",
            "Include locally downloaded Ollama models.",
          ],
          ["eve offline status --json", "Report local-model readiness in machine-readable form."],
        ])}`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await offlineBundleCommand(defaultRuntime, {
          output: opts.output as string,
          skipBuild: Boolean(opts.skipBuild),
          includeModels: Boolean(opts.includeModels),
          ollamaModels: opts.ollamaModels as string | undefined,
          includeOllama: Boolean(opts.includeOllama),
          ollamaBinary: opts.ollamaBinary as string | undefined,
          json: Boolean(opts.json),
        });
      });
    });

  offline
    .command("configure")
    .description("Configure an installed Ollama model as EVE's default local model")
    .requiredOption("--model <name>", "Installed Ollama model name")
    .option("--base-url <url>", "Ollama base URL", "http://127.0.0.1:11434")
    .option("--allow-missing", "Write config even when the model is not currently visible", false)
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await offlineConfigureCommand(defaultRuntime, {
          model: opts.model as string,
          baseUrl: opts.baseUrl as string,
          allowMissing: Boolean(opts.allowMissing),
          json: Boolean(opts.json),
        });
      });
    });
}
