import type { Command } from "commander";
import { resolveWorkboardCardByIdOrPrefix } from "./card-lookup.js";
import {
  missionAct,
  missionCreate,
  missionInstruction,
  missionOverview,
} from "./mission-control.js";
import type { WorkboardStore } from "./store.js";

type JsonOptions = { json?: boolean; board?: string };

function write(value: unknown, options: JsonOptions): void {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (value && typeof value === "object" && "tasks" in value) {
    const tasks =
      (value as { tasks?: Array<{ id: string; status: string; title: string }> }).tasks ?? [];
    for (const task of tasks) {
      process.stdout.write(`${task.id.slice(0, 8)}  ${task.status.padEnd(8)}  ${task.title}\n`);
    }
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function resolveId(store: WorkboardStore, value: string): Promise<string> {
  const { card, error } = resolveWorkboardCardByIdOrPrefix(await store.list(), value);
  if (!card) {
    throw new Error(error);
  }
  return card.id;
}

export function registerMissionCli(program: Command, store: WorkboardStore): void {
  const mission = program.command("mission").description("Operate EVE Mission Control");
  mission
    .command("status", { isDefault: true })
    .option("--board <id>")
    .option("--json", "Print JSON", false)
    .action(async (options: JsonOptions) =>
      write(await missionOverview(store, options.board), options),
    );
  mission
    .command("create")
    .argument("<title...>")
    .option("--notes <text>")
    .option("--agent <id>")
    .option("--priority <priority>", "low, normal, high, or urgent", "normal")
    .option("--board <id>")
    .option("--json", "Print JSON", false)
    .action(
      async (
        title: string[],
        options: JsonOptions & { notes?: string; agent?: string; priority: string },
      ) =>
        write(
          await missionCreate(store, {
            title: title.join(" "),
            notes: options.notes,
            agentId: options.agent,
            priority: options.priority,
            boardId: options.board,
          }),
          options,
        ),
    );
  mission
    .command("instruct")
    .argument("<id>")
    .argument("<message...>")
    .option("--author <name>", "Instruction author", "operator")
    .option("--json", "Print JSON", false)
    .action(async (id: string, message: string[], options: JsonOptions & { author: string }) =>
      write(
        await missionInstruction(store, await resolveId(store, id), {
          message: message.join(" "),
          author: options.author,
        }),
        options,
      ),
    );
  for (const action of ["pause", "resume", "retry"] as const) {
    mission
      .command(action)
      .argument("<id>")
      .option("--reason <text>")
      .option("--json", "Print JSON", false)
      .action(async (id: string, options: JsonOptions & { reason?: string }) =>
        write(
          await missionAct(store, await resolveId(store, id), { action, reason: options.reason }),
          options,
        ),
      );
  }
  mission
    .command("reassign")
    .argument("<id>")
    .argument("<agent>")
    .option("--reason <text>")
    .option("--json", "Print JSON", false)
    .action(async (id: string, agent: string, options: JsonOptions & { reason?: string }) =>
      write(
        await missionAct(store, await resolveId(store, id), {
          action: "reassign",
          agentId: agent,
          reason: options.reason,
        }),
        options,
      ),
    );
}
