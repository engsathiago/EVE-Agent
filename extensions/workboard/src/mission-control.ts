import type { WorkboardStore } from "./store.js";
import type { WorkboardCard, WorkboardPriority } from "./types.js";

function parentEdges(card: WorkboardCard): Array<{ from: string; to: string; type: string }> {
  return (card.metadata?.links ?? []).flatMap(
    (link): Array<{ from: string; to: string; type: string }> => {
      if (!link.targetCardId) {
        return [];
      }
      if (link.type === "parent" || link.type === "blocked_by") {
        return [{ from: link.targetCardId, to: card.id, type: link.type }];
      }
      if (link.type === "child" || link.type === "blocks") {
        return [{ from: card.id, to: link.targetCardId, type: link.type }];
      }
      return [];
    },
  );
}

function redact(card: WorkboardCard): WorkboardCard {
  const claim = card.metadata?.claim;
  return claim
    ? { ...card, metadata: { ...card.metadata, claim: { ...claim, token: "[redacted]" } } }
    : card;
}

export async function missionOverview(store: WorkboardStore, boardId?: string) {
  const [cards, boards, stats] = await Promise.all([
    store.list({ boardId }),
    store.listBoards(),
    store.stats({ boardId }),
  ]);
  const agents = new Map<
    string,
    { id: string; name: string; tasks: number; running: number; blocked: number }
  >();
  for (const card of cards) {
    const id = card.agentId || "unassigned";
    const entry = agents.get(id) ?? { id, name: id, tasks: 0, running: 0, blocked: 0 };
    entry.tasks += 1;
    if (card.status === "running") {
      entry.running += 1;
    }
    if (card.status === "blocked" || card.status === "triage") {
      entry.blocked += 1;
    }
    agents.set(id, entry);
  }
  return {
    boardId: boardId || "default",
    boards: boards.boards,
    stats,
    tasks: cards.map(redact),
    agents: [...agents.values()],
    edges: cards.flatMap(parentEdges),
  };
}

export async function missionCreate(
  store: WorkboardStore,
  input: {
    title?: unknown;
    notes?: unknown;
    agentId?: unknown;
    priority?: unknown;
    boardId?: unknown;
    parents?: unknown;
  },
) {
  return redact(
    await store.create({
      title: input.title,
      notes: input.notes,
      agentId: input.agentId,
      priority: input.priority as WorkboardPriority,
      boardId: input.boardId,
      parents: input.parents,
      status: "todo",
      labels: ["mission"],
    }),
  );
}

export async function missionInstruction(
  store: WorkboardStore,
  id: string,
  input: { message?: unknown; author?: unknown },
) {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) {
    throw new Error("message is required");
  }
  const author =
    typeof input.author === "string" && input.author.trim() ? input.author.trim() : "operator";
  return redact(await store.addComment(id, { body: `[${author}] ${message}` }));
}

export async function missionAct(
  store: WorkboardStore,
  id: string,
  input: { action?: unknown; agentId?: unknown; reason?: unknown },
) {
  const action = typeof input.action === "string" ? input.action : "";
  const reason = typeof input.reason === "string" ? input.reason : undefined;
  if (action === "pause") {
    return redact(await store.block(id, { reason }, null));
  }
  if (action === "resume") {
    const resumed = await store.unblock(id);
    return redact(await store.promote(resumed.id, { force: true, reason }, null));
  }
  if (action === "retry") {
    return redact(await store.reclaim(id, { status: "ready", reason }, null));
  }
  if (action === "reassign") {
    if (typeof input.agentId !== "string" || !input.agentId.trim()) {
      throw new Error("agentId is required for reassign");
    }
    return redact(
      await store.reassign(
        id,
        { agentId: input.agentId, status: "ready", resetFailures: true, reason },
        null,
      ),
    );
  }
  throw new Error("action must be pause, resume, retry, or reassign");
}
