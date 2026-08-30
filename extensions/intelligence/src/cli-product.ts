import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { writeValue, type JsonOption } from "./cli-utils.js";
import type { IntelligenceServices } from "./services.js";

export function registerEnvironmentCommands(
  program: Command,
  services: IntelligenceServices,
): void {
  const environments = program
    .command("environments")
    .description("Manage named Docker environments owned by EVE");
  environments
    .command("status", { isDefault: true })
    .option("--json", "Print JSON")
    .action(async (options: JsonOption) => writeValue(await services.environments.list(), options));
  environments
    .command("create")
    .argument("<name>")
    .option("--image <image>")
    .option("--ttl <minutes>", "Expiration in minutes", "120")
    .option("--cpu <number>", "CPU limit", "1")
    .option("--memory <mb>", "Memory limit in MB", "1024")
    .option("--persistent", "Persist /workspace", false)
    .option("--network", "Allow network access", false)
    .option("--json", "Print JSON")
    .action(
      async (
        name: string,
        options: JsonOption & {
          image?: string;
          ttl: string;
          cpu: string;
          memory: string;
          persistent: boolean;
          network: boolean;
        },
      ) =>
        writeValue(
          await services.environments.create({
            name,
            image: options.image,
            ttlMinutes: Number(options.ttl),
            cpu: Number(options.cpu),
            memoryMb: Number(options.memory),
            persistent: options.persistent,
            network: options.network,
          }),
          options,
        ),
    );
  for (const action of ["start", "stop", "restart"] as const) {
    environments
      .command(action)
      .argument("<id>")
      .option("--json", "Print JSON")
      .action(async (id: string, options: JsonOption) =>
        writeValue(await services.environments.control(id, action), options),
      );
  }
  environments
    .command("snapshot")
    .argument("<id>")
    .option("--name <name>")
    .option("--json", "Print JSON")
    .action(async (id: string, options: JsonOption & { name?: string }) =>
      writeValue(await services.environments.snapshot(id, options.name), options),
    );
  environments
    .command("delete")
    .argument("<id>")
    .option("--json", "Print JSON")
    .action(async (id: string, options: JsonOption) =>
      writeValue(await services.environments.remove(id), options),
    );
  environments
    .command("sweep")
    .option("--json", "Print JSON")
    .action(async (options: JsonOption) =>
      writeValue(await services.environments.sweepExpired(), options),
    );
}

export function registerStudioCommands(program: Command, services: IntelligenceServices): void {
  const studio = program.command("studio").description("Create and publish versioned artifacts");
  studio
    .command("list", { isDefault: true })
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.studio.list(), options));
  studio
    .command("create")
    .argument("<kind>", "document, presentation, spreadsheet, website, note, or diagram")
    .option("--title <title>")
    .option("--filename <name>")
    .option("--json", "Print JSON")
    .action((kind: string, options: JsonOption & { title?: string; filename?: string }) =>
      writeValue(services.studio.create(kind, options), options),
    );
  studio
    .command("import")
    .argument("<path>")
    .option("--title <title>")
    .option("--json", "Print JSON")
    .action((source: string, options: JsonOption & { title?: string }) => {
      const data = fs.readFileSync(source).toString("base64");
      writeValue(
        services.studio.import({
          filename: path.basename(source),
          dataBase64: data,
          title: options.title,
        }),
        options,
      );
    });
  studio
    .command("show")
    .argument("<id>")
    .option("--content", "Include file content", false)
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption & { content: boolean }) =>
      writeValue(services.studio.get(id, options.content), options),
    );
  studio
    .command("save")
    .argument("<id>")
    .requiredOption("--file <path>", "Read new text content from a file")
    .option("--title <title>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption & { file: string; title?: string }) =>
      writeValue(
        services.studio.save(id, {
          content: fs.readFileSync(options.file, "utf8"),
          title: options.title,
        }),
        options,
      ),
    );
  studio
    .command("publish")
    .argument("<id>")
    .option("--summary <text>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption & { summary?: string }) =>
      writeValue(services.studio.publish(id, options.summary), options),
    );
  studio
    .command("delete")
    .argument("<id>")
    .option("--json", "Print JSON")
    .action((id: string, options: JsonOption) => writeValue(services.studio.remove(id), options));
}

export function registerIntegrationCommands(
  program: Command,
  services: IntelligenceServices,
): void {
  const integrations = program
    .command("integrations")
    .description("List MCP servers, plugins, and channels in one catalog");
  integrations
    .command("list", { isDefault: true })
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.integrations.list(), options));
}

export function registerPackageCommands(program: Command, services: IntelligenceServices): void {
  const packages = program.command("packages").description("Manage professional work packages");
  packages
    .command("list", { isDefault: true })
    .option("--json", "Print JSON")
    .action((options: JsonOption) => writeValue(services.packages.list(), options));
  packages
    .command("install")
    .argument("<name-or-path>")
    .option("--force", "Replace an installed package", false)
    .option("--json", "Print JSON")
    .action((source: string, options: JsonOption & { force: boolean }) =>
      writeValue(services.packages.install(source, options.force), options),
    );
}
