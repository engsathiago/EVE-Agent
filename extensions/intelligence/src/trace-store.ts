import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OperationsDatabase } from "./database.js";
import { openOperationsDatabase, parseJsonObject } from "./database.js";
import type { EveTraceEvent, EveTraceRun, EveTraceStatus, JsonObject } from "./types.js";

type Row = Record<string, unknown>;

export type TraceStartInput = {
  runKey: string;
  sessionId?: string;
  sessionKey?: string;
  agentId?: string;
  platform?: string;
  model?: string;
  provider?: string;
  metadata?: JsonObject;
};

export type TraceEventInput = {
  eventType: string;
  spanKey?: string;
  parentSpanKey?: string;
  occurredAt?: number;
  durationMs?: number;
  status?: string;
  payload?: JsonObject;
};

export type TraceUsageInput = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  estimatedCostUsd?: number;
};

function stringValue(row: Row, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

function decodeRun(row: Row): EveTraceRun {
  const endedAt = row.ended_at === null ? undefined : numberValue(row, "ended_at");
  return {
    id: stringValue(row, "id"),
    runKey: stringValue(row, "run_key"),
    sessionId: stringValue(row, "session_id"),
    sessionKey: stringValue(row, "session_key"),
    agentId: stringValue(row, "agent_id"),
    platform: stringValue(row, "platform"),
    model: stringValue(row, "model"),
    provider: stringValue(row, "provider"),
    status: stringValue(row, "status") as EveTraceStatus,
    startedAt: numberValue(row, "started_at"),
    ...(endedAt === undefined ? {} : { endedAt }),
    inputTokens: numberValue(row, "input_tokens"),
    outputTokens: numberValue(row, "output_tokens"),
    cacheReadTokens: numberValue(row, "cache_read_tokens"),
    cacheWriteTokens: numberValue(row, "cache_write_tokens"),
    estimatedCostUsd: numberValue(row, "estimated_cost_usd"),
    modelCalls: numberValue(row, "model_calls"),
    toolCalls: numberValue(row, "tool_calls"),
    retries: numberValue(row, "retries"),
    errorCount: numberValue(row, "error_count"),
    summary: stringValue(row, "summary"),
    metadata: parseJsonObject(row.metadata_json),
  };
}

function decodeEvent(row: Row): EveTraceEvent {
  return {
    id: numberValue(row, "id"),
    runId: stringValue(row, "run_id"),
    eventType: stringValue(row, "event_type"),
    spanKey: stringValue(row, "span_key"),
    parentSpanKey: stringValue(row, "parent_span_key"),
    occurredAt: numberValue(row, "occurred_at"),
    durationMs: numberValue(row, "duration_ms"),
    status: stringValue(row, "status"),
    payload: parseJsonObject(row.payload_json),
  };
}

export class TraceStore {
  private readonly ownedDatabase?: OperationsDatabase;
  readonly db: DatabaseSync;

  constructor(database?: OperationsDatabase) {
    this.ownedDatabase = database ? undefined : openOperationsDatabase();
    this.db = database?.db ?? this.ownedDatabase!.db;
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  start(input: TraceStartInput): EveTraceRun {
    const existing = this.findByRunKey(input.runKey);
    if (existing?.status === "running") {
      return existing;
    }
    const id = `tr_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO trace_runs
         (id,run_key,session_id,session_key,agent_id,platform,model,provider,status,started_at,metadata_json)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.runKey,
        input.sessionId ?? "",
        input.sessionKey ?? "",
        input.agentId ?? "",
        input.platform ?? "",
        input.model ?? "",
        input.provider ?? "",
        "running",
        now,
        JSON.stringify(input.metadata ?? {}),
      );
    return this.get(id);
  }

  ensure(input: TraceStartInput): EveTraceRun {
    return this.findByRunKey(input.runKey) ?? this.start(input);
  }

  append(runId: string, input: TraceEventInput): EveTraceEvent {
    const result = this.db
      .prepare(
        `INSERT INTO trace_events
         (run_id,event_type,span_key,parent_span_key,occurred_at,duration_ms,status,payload_json)
         VALUES(?,?,?,?,?,?,?,?)`,
      )
      .run(
        runId,
        input.eventType,
        input.spanKey ?? "",
        input.parentSpanKey ?? "",
        input.occurredAt ?? Date.now(),
        Math.max(0, Math.trunc(input.durationMs ?? 0)),
        input.status ?? "",
        JSON.stringify(input.payload ?? {}),
      );
    const row = this.db
      .prepare("SELECT * FROM trace_events WHERE id=?")
      .get(result.lastInsertRowid) as Row | undefined;
    if (!row) {
      throw new Error("trace event was not persisted");
    }
    return decodeEvent(row);
  }

  recordModelStart(runId: string, model: string, provider: string): void {
    this.db
      .prepare(
        `UPDATE trace_runs SET model_calls=model_calls+1,
         model=CASE WHEN ?='' THEN model ELSE ? END,
         provider=CASE WHEN ?='' THEN provider ELSE ? END WHERE id=?`,
      )
      .run(model, model, provider, provider, runId);
  }

  recordUsage(runId: string, usage: TraceUsageInput): void {
    this.db
      .prepare(
        `UPDATE trace_runs SET input_tokens=input_tokens+?,output_tokens=output_tokens+?,
         cache_read_tokens=cache_read_tokens+?,cache_write_tokens=cache_write_tokens+?,
         estimated_cost_usd=estimated_cost_usd+? WHERE id=?`,
      )
      .run(
        Math.max(0, Math.trunc(usage.input ?? 0)),
        Math.max(0, Math.trunc(usage.output ?? 0)),
        Math.max(0, Math.trunc(usage.cacheRead ?? 0)),
        Math.max(0, Math.trunc(usage.cacheWrite ?? 0)),
        Math.max(0, usage.estimatedCostUsd ?? 0),
        runId,
      );
  }

  recordToolStart(runId: string): void {
    this.db.prepare("UPDATE trace_runs SET tool_calls=tool_calls+1 WHERE id=?").run(runId);
  }

  recordError(runId: string, retry = false): void {
    this.db
      .prepare("UPDATE trace_runs SET error_count=error_count+1,retries=retries+? WHERE id=?")
      .run(retry ? 1 : 0, runId);
  }

  setSummary(runId: string, summary: string): void {
    this.db
      .prepare("UPDATE trace_runs SET summary=? WHERE id=?")
      .run(summary.slice(0, 12_000), runId);
  }

  finish(runId: string, status: Exclude<EveTraceStatus, "running">, summary?: string): EveTraceRun {
    this.db
      .prepare(
        `UPDATE trace_runs SET status=?,ended_at=?,summary=CASE WHEN ?='' THEN summary ELSE ? END
         WHERE id=? AND status='running'`,
      )
      .run(status, Date.now(), summary ?? "", summary ?? "", runId);
    return this.get(runId);
  }

  finishSession(sessionId: string, status: Exclude<EveTraceStatus, "running">): number {
    const result = this.db
      .prepare("UPDATE trace_runs SET status=?,ended_at=? WHERE session_id=? AND status='running'")
      .run(status, Date.now(), sessionId);
    return Number(result.changes);
  }

  findByRunKey(runKey: string): EveTraceRun | undefined {
    const row = this.db
      .prepare("SELECT * FROM trace_runs WHERE run_key=? ORDER BY started_at DESC LIMIT 1")
      .get(runKey) as Row | undefined;
    return row ? decodeRun(row) : undefined;
  }

  findByEvaluationRunKey(runKey: string): EveTraceRun | undefined {
    const row = this.db
      .prepare(
        "SELECT * FROM trace_runs WHERE json_extract(metadata_json,'$.evaluationRunKey')=? ORDER BY started_at DESC LIMIT 1",
      )
      .get(runKey) as Row | undefined;
    return row ? this.get(stringValue(row, "id")) : undefined;
  }

  get(id: string): EveTraceRun {
    const row = this.db.prepare("SELECT * FROM trace_runs WHERE id=?").get(id) as Row | undefined;
    if (!row) {
      throw new Error(`trace not found: ${id}`);
    }
    const events = this.db
      .prepare("SELECT * FROM trace_events WHERE run_id=? ORDER BY occurred_at,id")
      .all(id) as Row[];
    const run = decodeRun(row);
    const endedAt = run.endedAt ?? Date.now();
    return {
      ...run,
      events: events.map(decodeEvent),
      durationMs: Math.max(0, endedAt - run.startedAt),
    };
  }

  list(options: { limit?: number; status?: EveTraceStatus; runKey?: string } = {}): EveTraceRun[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (options.status) {
      clauses.push("status=?");
      params.push(options.status);
    }
    if (options.runKey) {
      clauses.push("run_key=?");
      params.push(options.runKey);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(Math.max(1, Math.min(500, Math.trunc(options.limit ?? 50))));
    return (
      this.db
        .prepare(`SELECT * FROM trace_runs ${where} ORDER BY started_at DESC LIMIT ?`)
        .all(...params) as Row[]
    ).map(decodeRun);
  }

  replay(id: string): JsonObject {
    const trace = this.get(id);
    const inputEvent = trace.events?.find((event) => event.eventType === "llm_input");
    const prompt = typeof inputEvent?.payload.prompt === "string" ? inputEvent.payload.prompt : "";
    return {
      sourceTrace: id,
      model: trace.model,
      provider: trace.provider,
      platform: trace.platform,
      prompt,
      replayCommand: `eve agent --model ${trace.provider}/${trace.model} --message <prompt>`,
    };
  }

  prune(options: { maxAgeDays?: number; keepLatest?: number; execute?: boolean } = {}): JsonObject {
    const days = Math.max(1, Math.trunc(options.maxAgeDays ?? 30));
    const keep = Math.max(100, Math.trunc(options.keepLatest ?? 5000));
    const cutoff = Date.now() - days * 86_400_000;
    const rows = this.db
      .prepare(
        `SELECT id FROM trace_runs WHERE status!='running' AND
         (COALESCE(ended_at,started_at) < ? OR id NOT IN
          (SELECT id FROM trace_runs ORDER BY started_at DESC LIMIT ?))`,
      )
      .all(cutoff, keep) as Row[];
    const ids = rows.map((row) => stringValue(row, "id"));
    if (options.execute) {
      const remove = this.db.prepare("DELETE FROM trace_runs WHERE id=?");
      for (const id of ids) {
        remove.run(id);
      }
    }
    return {
      executed: options.execute === true,
      [options.execute ? "removed" : "wouldRemove"]: ids.length,
      maxAgeDays: days,
      keepLatest: keep,
    };
  }

  status(): JsonObject {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) total,
         SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) running,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,
         SUM(error_count) errors,SUM(model_calls) model_calls,SUM(tool_calls) tool_calls
         FROM trace_runs`,
      )
      .get() as Row;
    return {
      total: numberValue(row, "total"),
      running: numberValue(row, "running"),
      completed: numberValue(row, "completed"),
      errors: numberValue(row, "errors"),
      modelCalls: numberValue(row, "model_calls"),
      toolCalls: numberValue(row, "tool_calls"),
      latest: this.list({ limit: 1 })[0] ?? null,
    };
  }
}
