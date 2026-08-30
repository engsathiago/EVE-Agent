import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openOperationsDatabase, type OperationsDatabase } from "./database.js";
import { ResultStore } from "./result-store.js";
import { runRemoteWorker, startWorkerController } from "./worker-runtime.js";
import { WorkerStore } from "./worker-store.js";

const roots: string[] = [];
const databases: OperationsDatabase[] = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eve-worker-runtime-"));
  roots.push(root);
  const database = openOperationsDatabase(path.join(root, "operations.sqlite"));
  databases.push(database);
  const results = new ResultStore(database, path.join(root, "results"));
  return { database, results, workers: new WorkerStore(database, results) };
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("EVE remote worker runtime", () => {
  it("requires separate operator and node credentials even on loopback", async () => {
    const { workers } = fixture();
    await expect(startWorkerController({ workers, port: 0 })).rejects.toThrow(
      /operator-token.*worker-token/,
    );
  });

  it("authenticates the controller, executes a remote lease, and publishes the result", async () => {
    const { results, workers } = fixture();
    const controller = await startWorkerController({
      workers,
      host: "127.0.0.1",
      port: 0,
      operatorToken: "operator-token",
      workerTokens: { "worker-one": "worker-one-token" },
    });
    try {
      expect((await fetch(`${controller.url}/health`)).status).toBe(200);
      expect((await fetch(`${controller.url}/status`)).status).toBe(401);
      expect(
        (
          await fetch(`${controller.url}/status`, {
            headers: { authorization: "Bearer worker-one-token" },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(`${controller.url}/status`, {
            headers: { authorization: "Bearer operator-token" },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await fetch(`${controller.url}/submit`, {
            method: "POST",
            headers: {
              authorization: "Bearer worker-one-token",
              "content-type": "application/json",
            },
            body: JSON.stringify({ kind: "command" }),
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(`${controller.url}/claim`, {
            method: "POST",
            headers: {
              authorization: "Bearer worker-one-token",
              "content-type": "application/json",
            },
            body: JSON.stringify({ id: "worker-two" }),
          })
        ).status,
      ).toBe(401);
      const job = workers.submit({
        kind: "command",
        payload: { command: ["ignored"] },
        requirements: ["test"],
      });
      const completed = await runRemoteWorker({
        controller: controller.url,
        token: "worker-one-token",
        nodeId: "worker-one",
        capabilities: ["command", "test"],
        once: true,
        executor: async (claimed) => ({ stdout: `completed ${claimed.id}` }),
      });
      expect(completed).toMatchObject({ id: job.id, status: "completed" });
      expect(workers.getNode("worker-one")).toMatchObject({ status: "online", activeJobs: 0 });
      expect(results.findBySource("distributed_job", job.id)).toMatchObject({ status: "ready" });
    } finally {
      await controller.close();
    }
  });

  it("requeues failed leases until max attempts and then publishes a failure", async () => {
    const { results, workers } = fixture();
    const controller = await startWorkerController({
      workers,
      port: 0,
      operatorToken: "retry-operator-token",
      workerTokens: { "worker-retry": "retry-worker-token" },
    });
    try {
      const job = workers.submit({ kind: "command", maxAttempts: 2 });
      const options = {
        controller: controller.url,
        nodeId: "worker-retry",
        token: "retry-worker-token",
        once: true,
        executor: async () => {
          throw new Error("simulated failure");
        },
      };
      expect(await runRemoteWorker(options)).toMatchObject({ id: job.id, status: "queued" });
      expect(results.findBySource("distributed_job", job.id)).toBeUndefined();
      expect(await runRemoteWorker(options)).toMatchObject({ id: job.id, status: "failed" });
      expect(results.findBySource("distributed_job", job.id)).toMatchObject({ status: "failed" });
    } finally {
      await controller.close();
    }
  });
});
