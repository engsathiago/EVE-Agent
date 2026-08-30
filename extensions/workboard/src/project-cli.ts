import type { Command } from "commander";
import type { ProjectStore } from "./project-store.js";

type Options = { json?: boolean };

function write(value: unknown, options: Options): void {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  } else if (Array.isArray(value)) {
    for (const item of value as Array<{ slug: string; name: string; primaryPath: string }>) {
      process.stdout.write(`${item.slug.padEnd(24)}  ${item.name}  ${item.primaryPath}\n`);
    }
  } else {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function registerProjectCli(program: Command, projects: ProjectStore): void {
  const root = program.command("projects").description("Manage named multi-folder EVE projects");
  root
    .command("list", { isDefault: true })
    .option("--all", "Include archived projects", false)
    .option("--json", "Print JSON", false)
    .action((options: Options & { all: boolean }) => write(projects.list(options.all), options));
  root
    .command("create")
    .argument("<name>")
    .option("--slug <slug>")
    .option("--description <text>")
    .option("--folder <path>", "Project folder; repeat for multiple", collect, [])
    .option("--primary <path>")
    .option("--board <id>")
    .option("--icon <value>")
    .option("--color <value>")
    .option("--json", "Print JSON", false)
    .action(
      (
        name: string,
        options: Options & {
          slug?: string;
          description?: string;
          folder: string[];
          primary?: string;
          board?: string;
          icon?: string;
          color?: string;
        },
      ) =>
        write(
          projects.create({
            name,
            slug: options.slug,
            description: options.description,
            folders: options.folder,
            primaryPath: options.primary,
            boardId: options.board,
            icon: options.icon,
            color: options.color,
          }),
          options,
        ),
    );
  root
    .command("show")
    .argument("<id-or-slug>")
    .option("--json", "Print JSON", false)
    .action((id: string, options: Options) => write(projects.get(id), options));
  root
    .command("add-folder")
    .argument("<id-or-slug>")
    .argument("<path>")
    .option("--label <label>")
    .option("--primary", "Make this the primary folder", false)
    .option("--json", "Print JSON", false)
    .action((id: string, folder: string, options: Options & { label?: string; primary: boolean }) =>
      write(projects.addFolder(id, folder, options), options),
    );
  root
    .command("remove-folder")
    .argument("<id-or-slug>")
    .argument("<path>")
    .option("--json", "Print JSON", false)
    .action((id: string, folder: string, options: Options) =>
      write(projects.removeFolder(id, folder), options),
    );
  root
    .command("match")
    .argument("<path>")
    .option("--json", "Print JSON", false)
    .action((target: string, options: Options) =>
      write({ project: projects.match(target) ?? null }, options),
    );
  root
    .command("archive")
    .argument("<id-or-slug>")
    .option("--restore", "Unarchive the project", false)
    .option("--json", "Print JSON", false)
    .action((id: string, options: Options & { restore: boolean }) =>
      write(projects.archive(id, !options.restore), options),
    );
  root
    .command("delete")
    .argument("<id-or-slug>")
    .option("--json", "Print JSON", false)
    .action((id: string, options: Options) => write(projects.remove(id), options));
}
