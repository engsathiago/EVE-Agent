import { describe, expect, it } from "vitest";
import {
  missionAct,
  missionCreate,
  missionInstruction,
  missionOverview,
} from "./mission-control.js";
import { WorkboardStore, type PersistedWorkboardCard, type WorkboardKeyedStore } from "./store.js";

function createMemoryStore<T = PersistedWorkboardCard>(): WorkboardKeyedStore<T> {
  const entries = new Map<string, T>();
  return {
    async register(key, value) {
      entries.set(key, value);
    },
    async lookup(key) {
      return entries.get(key);
    },
    async delete(key) {
      return entries.delete(key);
    },
    async entries() {
      return [...entries].map(([key, value]) => ({ key, value }));
    },
  };
}

describe("EVE Mission Control", () => {
  it("creates, instructs, pauses, resumes, retries, and reassigns shared Workboard tasks", async () => {
    const store = new WorkboardStore(createMemoryStore());
    const task = await missionCreate(store, {
      title: "Ship EVE",
      agentId: "builder",
      priority: "high",
    });
    expect(task.labels).toContain("mission");
    const instructed = await missionInstruction(store, task.id, {
      author: "owner",
      message: "Finish the release",
    });
    expect(instructed.metadata?.comments?.at(-1)?.body).toContain("[owner]");
    expect((await missionAct(store, task.id, { action: "pause" })).status).toBe("blocked");
    expect((await missionAct(store, task.id, { action: "resume" })).status).toBe("ready");
    expect((await missionAct(store, task.id, { action: "retry" })).status).toBe("ready");
    expect(
      (await missionAct(store, task.id, { action: "reassign", agentId: "reviewer" })).agentId,
    ).toBe("reviewer");
    const overview = await missionOverview(store);
    expect(overview.tasks).toHaveLength(1);
    expect(overview.agents).toContainEqual(expect.objectContaining({ id: "reviewer", tasks: 1 }));
  });
});
