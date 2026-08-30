import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OperationsDatabase } from "./database.js";
import {
  openOperationsDatabase,
  parseJsonArray,
  parseJsonObject,
  runTransaction,
} from "./database.js";
import type { ResultStore } from "./result-store.js";
import type { EveWorkerJob, EveWorkerNode, JsonObject } from "./types.js";

type Row = Record<string, unknown>;

export const WORKER_JOB_KINDS = ["eve", "agent", "command", "flow"] as const;
const workerJobKinds = new Set<string>(WORKER_JOB_KINDS);

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] : "";
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

function decodeNode(row: Row): EveWorkerNode {
  const node: EveWorkerNode = {
    id: text(row, "id"),
    name: text(row, "name"),
    endpoint: text(row, "endpoint"),
    labels: parseJsonArray(row.labels_json),
    capabilities: parseJsonArray(row.capabilities_json),
    status: text(row, "status") as EveWorkerNode["status"],
    lastHeartbeat: number(row, "last_heartbeat"),
    activeJobs: number(row, "active_jobs"),
    maxJobs: number(row, "max_jobs"),
    metadata: parseJsonObject(row.metadata_json),
  };
  if (node.lastHeartbeat < Date.now() - 90_000) {
    node.status = "offline";
  }
  return node;
}

function decodeJob(row: Row): EveWorkerJob {
  return {
    id: text(row, "id"),
    kind: text(row, "kind"),
    payload: parseJsonObject(row.payload_json),
    requirements: parseJsonArray(row.requirements_json),
    status: text(row, "status") as EveWorkerJob["status"],
    priority: number(row, "priority"),
    workerId: text(row, "worker_id"),
    leaseUntil: number(row, "lease_until"),
    attempts: number(row, "attempts"),
    maxAttempts: number(row, "max_attempts"),
    result: parseJsonObject(row.result_json),
    error: text(row, "error"),
    createdAt: number(row, "created_at"),
    updatedAt: number(row, "updated_at"),
  };
}

export class WorkerStore {
  private readonly ownedDatabase?: OperationsDatabase;
  readonly db: DatabaseSync;

  constructor(
    database?: OperationsDatabase,
    private readonly results?: ResultStore,
  ) {
    this.ownedDatabase = database ? undefined : openOperationsDatabase();
    this.db = database?.db ?? this.ownedDatabase!.db;
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  registerNode(input: {
    id: string;
    name?: string;
    endpoint?: string;
    labels?: string[];
    capabilities?: string[];
    maxJobs?: number;
    metadata?: JsonObject;
  }): EveWorkerNode {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO worker_nodes
         (id,name,endpoint,labels_json,capabilities_json,status,last_heartbeat,active_jobs,max_jobs,metadata_json)
         VALUES(?,?,?,?,?,'online',?,0,?,?) ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,endpoint=excluded.endpoint,labels_json=excluded.labels_json,
         capabilities_json=excluded.capabilities_json,status='online',last_heartbeat=excluded.last_heartbeat,
         max_jobs=excluded.max_jobs,metadata_json=excluded.metadata_json`,
      )
      .run(
        input.id,
        input.name ?? input.id,
        input.endpoint ?? "",
        JSON.stringify(input.labels ?? []),
        JSON.stringify(input.capabilities ?? []),
        now,
        Math.max(1, Math.trunc(input.maxJobs ?? 1)),
        JSON.stringify(input.metadata ?? {}),
      );
    return this.getNode(input.id);
  }

  heartbeat(id: string, activeJobs?: number): EveWorkerNode {
    const node = this.getNode(id);
    const jobs = activeJobs ?? node.activeJobs;
    this.db
      .prepare("UPDATE worker_nodes SET status=?,last_heartbeat=?,active_jobs=? WHERE id=?")
      .run(jobs >= node.maxJobs ? "busy" : "online", Date.now(), Math.max(0, Math.trunc(jobs)), id);
    return this.getNode(id);
  }

  getNode(id: string): EveWorkerNode {
    const row = this.db.prepare("SELECT * FROM worker_nodes WHERE id=?").get(id) as Row | undefined;
    if (!row) {
      throw new Error(`worker node not found: ${id}`);
    }
    return decodeNode(row);
  }

  listNodes(): EveWorkerNode[] {
    return (
      this.db.prepare("SELECT * FROM worker_nodes ORDER BY last_heartbeat DESC").all() as Row[]
    ).map(decodeNode);
  }

  submit(input: {
    kind: string;
    payload?: JsonObject;
    requirements?: string[];
    priority?: number;
    maxAttempts?: number;
  }): EveWorkerJob {
    if (!workerJobKinds.has(input.kind)) {
      throw new Error(`unsupported worker job kind: ${input.kind}`);
    }
    const id = `job_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO worker_jobs
         (id,kind,payload_json,requirements_json,status,priority,worker_id,lease_until,attempts,max_attempts,result_json,error,created_at,updated_at)
         VALUES(?,?,?,?,'queued',?,'',0,0,?,'{}','',?,?)`,
      )
      .run(
        id,
        input.kind,
        JSON.stringify(input.payload ?? {}),
        JSON.stringify(input.requirements ?? []),
        Math.trunc(input.priority ?? 0),
        Math.max(1, Math.trunc(input.maxAttempts ?? 3)),
        now,
        now,
      );
    return this.getJob(id);
  }

  private reconcileExpiredLeases(now: number): void {
    this.db
      .prepare(
        `UPDATE worker_jobs SET status='queued',worker_id='',lease_until=0,updated_at=?
         WHERE status='leased' AND lease_until<=? AND attempts<max_attempts`,
      )
      .run(now, now);
    this.db
      .prepare(
        `UPDATE worker_jobs SET status='failed',error='lease expired after maximum attempts',
         worker_id='',lease_until=0,updated_at=?
         WHERE status='leased' AND lease_until<=? AND attempts>=max_attempts`,
      )
      .run(now, now);
    // worker_jobs is the durable lease owner; rebuild counters from it so a
    // dead worker cannot leave a node permanently at capacity.
    this.db.exec(`
      UPDATE worker_nodes SET
        active_jobs=(
          SELECT COUNT(*) FROM worker_jobs
          WHERE status='leased' AND worker_id=worker_nodes.id
        ),
        status=CASE WHEN (
          SELECT COUNT(*) FROM worker_jobs
          WHERE status='leased' AND worker_id=worker_nodes.id
        )>=max_jobs THEN 'busy' ELSE 'online' END
    `);
  }

  claim(nodeId: string, leaseMs = 900_000): EveWorkerJob | undefined {
    return runTransaction(this.db, () => {
      const now = Date.now();
      this.reconcileExpiredLeases(now);
      const node = this.getNode(nodeId);
      if (node.activeJobs >= node.maxJobs) {
        return undefined;
      }
      const available = new Set([...node.labels, ...node.capabilities]);
      const capabilities = new Set(node.capabilities);
      const candidates = this.db
        .prepare(
          "SELECT * FROM worker_jobs WHERE status='queued' ORDER BY priority DESC,created_at",
        )
        .all() as Row[];
      const selected = candidates
        .map(decodeJob)
        .find(
          (job) =>
            capabilities.has(job.kind) && job.requirements.every((item) => available.has(item)),
        );
      if (!selected) {
        return undefined;
      }
      const result = this.db
        .prepare(
          `UPDATE worker_jobs SET status='leased',worker_id=?,lease_until=?,attempts=attempts+1,updated_at=?
           WHERE id=? AND status='queued'`,
        )
        .run(nodeId, now + Math.max(1000, Math.trunc(leaseMs)), now, selected.id);
      if (Number(result.changes) !== 1) {
        return undefined;
      }
      this.db
        .prepare(
          "UPDATE worker_nodes SET active_jobs=active_jobs+1,status='busy',last_heartbeat=? WHERE id=?",
        )
        .run(now, nodeId);
      return this.getJob(selected.id);
    });
  }

  renew(nodeId: string, jobId: string, attempt: number, leaseMs = 900_000): EveWorkerJob {
    return runTransaction(this.db, () => {
      const now = Date.now();
      const job = this.getJob(jobId);
      if (
        job.status !== "leased" ||
        job.workerId !== nodeId ||
        job.attempts !== attempt ||
        job.leaseUntil <= now
      ) {
        throw new Error(`job ${jobId} is not actively leased to worker ${nodeId}`);
      }
      this.db
        .prepare("UPDATE worker_jobs SET lease_until=?,updated_at=? WHERE id=?")
        .run(now + Math.max(1_000, Math.trunc(leaseMs)), now, jobId);
      return this.getJob(jobId);
    });
  }

  complete(
    nodeId: string,
    jobId: string,
    input: { attempt: number; result?: JsonObject; error?: string },
  ): EveWorkerJob {
    return runTransaction(this.db, () => {
      const job = this.getJob(jobId);
      if (
        job.status !== "leased" ||
        job.workerId !== nodeId ||
        job.attempts !== input.attempt ||
        job.leaseUntil <= Date.now()
      ) {
        throw new Error(`job ${jobId} is not leased to worker ${nodeId}`);
      }
      const status = input.error
        ? job.attempts < job.maxAttempts
          ? "queued"
          : "failed"
        : "completed";
      this.db
        .prepare(
          `UPDATE worker_jobs SET status=?,result_json=?,error=?,lease_until=0,updated_at=? WHERE id=?`,
        )
        .run(status, JSON.stringify(input.result ?? {}), input.error ?? "", Date.now(), jobId);
      if (status === "queued") {
        this.db.prepare("UPDATE worker_jobs SET worker_id='' WHERE id=?").run(jobId);
      }
      this.db
        .prepare(
          `UPDATE worker_nodes SET active_jobs=MAX(0,active_jobs-1),status='online',last_heartbeat=? WHERE id=?`,
        )
        .run(Date.now(), nodeId);
      const completed = this.getJob(jobId);
      if (completed.status === "completed" || completed.status === "failed") {
        this.results?.create({
          sourceType: "distributed_job",
          sourceId: completed.id,
          title: `Distributed job ${completed.id}`,
          summary: completed.error || JSON.stringify(completed.result).slice(0, 4000),
          status: completed.status === "completed" ? "ready" : "failed",
          metadata: completed as unknown as JsonObject,
        });
      }
      return completed;
    });
  }

  getJob(id: string): EveWorkerJob {
    const row = this.db.prepare("SELECT * FROM worker_jobs WHERE id=?").get(id) as Row | undefined;
    if (!row) {
      throw new Error(`worker job not found: ${id}`);
    }
    return decodeJob(row);
  }

  listJobs(options: { status?: EveWorkerJob["status"]; limit?: number } = {}): EveWorkerJob[] {
    const limit = Math.max(1, Math.min(500, Math.trunc(options.limit ?? 100)));
    const rows = options.status
      ? (this.db
          .prepare(
            "SELECT * FROM worker_jobs WHERE status=? ORDER BY priority DESC,created_at LIMIT ?",
          )
          .all(options.status, limit) as Row[])
      : (this.db
          .prepare("SELECT * FROM worker_jobs ORDER BY updated_at DESC LIMIT ?")
          .all(limit) as Row[]);
    return rows.map(decodeJob);
  }

  status(): JsonObject {
    const rows = this.db
      .prepare("SELECT status,COUNT(*) count FROM worker_jobs GROUP BY status")
      .all() as Row[];
    return {
      nodes: this.listNodes(),
      jobCounts: Object.fromEntries(rows.map((row) => [text(row, "status"), number(row, "count")])),
      queued: this.listJobs({ status: "queued", limit: 20 }),
    };
  }
}
