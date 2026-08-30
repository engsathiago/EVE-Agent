import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OperationsDatabase } from "./database.js";
import { openOperationsDatabase, parseJsonObject, runTransaction } from "./database.js";
import type { EveFlowDefinition, EveFlowRun, EveFlowStepRun, JsonObject } from "./types.js";

type Row = Record<string, unknown>;
const flowStepTypes = new Set(["wait", "value", "command", "agent"]);

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] : "";
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

function optionalNumber(row: Row, key: string): number | undefined {
  return row[key] === null || row[key] === undefined ? undefined : number(row, key);
}

function validateDefinition(input: EveFlowDefinition): EveFlowDefinition {
  const name = input.name.trim();
  if (!name) {
    throw new Error("flow name is required");
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new Error("flow requires at least one step");
  }
  const ids = new Set<string>();
  for (const step of input.steps) {
    if (!flowStepTypes.has(step.type)) {
      throw new Error(`unsupported flow step type: ${step.type}`);
    }
    const id = step.id.trim();
    if (!id || ids.has(id)) {
      throw new Error(`flow step id must be unique: ${step.id}`);
    }
    if (
      step.retries !== undefined &&
      (!Number.isInteger(step.retries) || step.retries < 0 || step.retries > 100)
    ) {
      throw new Error(`flow step retries must be an integer from 0 to 100: ${step.id}`);
    }
    ids.add(id);
  }
  for (const step of input.steps) {
    for (const dependency of step.needs ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(`unknown dependency ${dependency} for step ${step.id}`);
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(input.steps.map((step) => [step.id, step]));
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      throw new Error(`flow contains a dependency cycle at ${id}`);
    }
    if (visited.has(id)) {
      return;
    }
    visiting.add(id);
    for (const dependency of byId.get(id)?.needs ?? []) {
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) {
    visit(id);
  }
  return { ...input, name, steps: input.steps.map((step) => ({ ...step, id: step.id.trim() })) };
}

function decodeStep(row: Row): EveFlowStepRun {
  return {
    stepId: text(row, "step_id"),
    status: text(row, "status") as EveFlowStepRun["status"],
    attempt: number(row, "attempt"),
    ...(optionalNumber(row, "started_at") === undefined
      ? {}
      : { startedAt: optionalNumber(row, "started_at") }),
    ...(optionalNumber(row, "ended_at") === undefined
      ? {}
      : { endedAt: optionalNumber(row, "ended_at") }),
    input: parseJsonObject(row.input_json),
    output: parseJsonObject(row.output_json),
    error: text(row, "error"),
    checkpoint: parseJsonObject(row.checkpoint_json),
  };
}

export class FlowStore {
  private readonly ownedDatabase?: OperationsDatabase;
  readonly db: DatabaseSync;

  constructor(database?: OperationsDatabase) {
    this.ownedDatabase = database ? undefined : openOperationsDatabase();
    this.db = database?.db ?? this.ownedDatabase!.db;
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  install(input: EveFlowDefinition): EveFlowDefinition & { id: string; version: number } {
    const definition = validateDefinition(input);
    const existing = this.db
      .prepare("SELECT id,version,created_at FROM flow_definitions WHERE name=?")
      .get(definition.name) as Row | undefined;
    const id = existing
      ? text(existing, "id")
      : `flow_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const version = existing
      ? number(existing, "version") + 1
      : Math.max(1, definition.version ?? 1);
    const now = Date.now();
    const value = { ...definition, id, version };
    this.db
      .prepare(
        `INSERT INTO flow_definitions(id,name,version,definition_json,created_at,updated_at)
         VALUES(?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET
         version=excluded.version,definition_json=excluded.definition_json,updated_at=excluded.updated_at`,
      )
      .run(
        id,
        definition.name,
        version,
        JSON.stringify(value),
        existing ? number(existing, "created_at") : now,
        now,
      );
    return value;
  }

  getDefinition(idOrName: string): EveFlowDefinition & { id: string; version: number } {
    const row = this.db
      .prepare(
        "SELECT * FROM flow_definitions WHERE id=? OR name=? ORDER BY updated_at DESC LIMIT 1",
      )
      .get(idOrName, idOrName) as Row | undefined;
    if (!row) {
      throw new Error(`flow not found: ${idOrName}`);
    }
    const definition = parseJsonObject(row.definition_json) as EveFlowDefinition;
    return {
      ...definition,
      id: text(row, "id"),
      name: text(row, "name"),
      version: number(row, "version"),
    };
  }

  listDefinitions(): Array<EveFlowDefinition & { id: string; version: number }> {
    const rows = this.db.prepare("SELECT * FROM flow_definitions ORDER BY name").all() as Row[];
    return rows.map((row) => {
      const definition = parseJsonObject(row.definition_json) as EveFlowDefinition;
      return Object.assign({}, definition, {
        id: text(row, "id"),
        name: text(row, "name"),
        version: number(row, "version"),
      });
    });
  }

  remove(idOrName: string): boolean {
    const row = this.db
      .prepare("SELECT id FROM flow_definitions WHERE id=? OR name=? LIMIT 1")
      .get(idOrName, idOrName) as Row | undefined;
    if (!row) {
      return false;
    }
    // A package replacement removes the definition and its immutable run snapshots
    // together. Leaving runs behind would violate the foreign-key relationship and
    // let an obsolete package remain visible through status/history APIs.
    const id = text(row, "id");
    this.db.prepare("DELETE FROM flow_runs WHERE flow_id=?").run(id);
    this.db.prepare("DELETE FROM flow_definitions WHERE id=?").run(id);
    return true;
  }

  start(flow: string, input: JsonObject = {}, parentRunId = ""): EveFlowRun {
    const definition = this.getDefinition(flow);
    return this.createRun(definition, input, parentRunId);
  }

  startFromRun(sourceRunId: string, input: JsonObject, parentRunId: string): EveFlowRun {
    return this.createRun(this.getDefinitionForRun(sourceRunId), input, parentRunId);
  }

  private createRun(
    definition: EveFlowDefinition & { id: string; version: number },
    input: JsonObject,
    parentRunId: string,
  ): EveFlowRun {
    const id = `fr_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const now = Date.now();
    runTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO flow_runs
           (id,flow_id,status,input_json,output_json,error,parent_run_id,created_at,updated_at)
           VALUES(?,?,'pending',?,'{}','',?,?,?)`,
        )
        .run(id, definition.id, JSON.stringify(input), parentRunId, now, now);
      this.db
        .prepare(
          `INSERT INTO flow_run_definitions(run_id,flow_version,definition_json)
           VALUES(?,?,?)`,
        )
        .run(id, definition.version, JSON.stringify(definition));
      const insert = this.db.prepare(
        `INSERT INTO flow_step_runs
         (run_id,step_id,ordinal,status,attempt,input_json,output_json,error,checkpoint_json)
         VALUES(?,?,?,'pending',0,'{}','{}','','{}')`,
      );
      definition.steps.forEach((step, ordinal) => insert.run(id, step.id, ordinal));
    });
    return this.getRun(id);
  }

  getDefinitionForRun(runId: string): EveFlowDefinition & { id: string; version: number } {
    const run = this.getRun(runId);
    const row = this.db
      .prepare("SELECT flow_version,definition_json FROM flow_run_definitions WHERE run_id=?")
      .get(runId) as Row | undefined;
    if (row) {
      const definition = parseJsonObject(row.definition_json) as EveFlowDefinition;
      return {
        ...definition,
        id: run.flowId,
        name: definition.name || run.flowName,
        version: number(row, "flow_version"),
      };
    }
    // Existing databases may contain runs created before immutable snapshots
    // were introduced. Snapshot the best available definition on first read.
    const definition = this.getDefinition(run.flowId);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO flow_run_definitions(run_id,flow_version,definition_json)
         VALUES(?,?,?)`,
      )
      .run(runId, definition.version, JSON.stringify(definition));
    return definition;
  }

  assertModelRunnableDefinition(flow: string): void {
    this.assertModelRunnable(this.getDefinition(flow));
  }

  assertModelRunnableRun(runId: string): void {
    this.assertModelRunnable(this.getDefinitionForRun(runId));
  }

  private assertModelRunnable(definition: EveFlowDefinition): void {
    if (definition.steps.some((step) => step.type === "command")) {
      throw new Error(
        "command flows must be executed through the operator CLI or authenticated Gateway RPC",
      );
    }
  }

  getRun(id: string): EveFlowRun {
    const row = this.db
      .prepare(
        `SELECT r.*,d.name flow_name,COALESCE(v.flow_version,d.version) flow_version
         FROM flow_runs r JOIN flow_definitions d ON d.id=r.flow_id
         LEFT JOIN flow_run_definitions v ON v.run_id=r.id WHERE r.id=?`,
      )
      .get(id) as Row | undefined;
    if (!row) {
      throw new Error(`flow run not found: ${id}`);
    }
    const steps = this.db
      .prepare("SELECT * FROM flow_step_runs WHERE run_id=? ORDER BY ordinal")
      .all(id) as Row[];
    return {
      id: text(row, "id"),
      flowId: text(row, "flow_id"),
      flowName: text(row, "flow_name"),
      flowVersion: number(row, "flow_version"),
      status: text(row, "status") as EveFlowRun["status"],
      input: parseJsonObject(row.input_json),
      output: parseJsonObject(row.output_json),
      error: text(row, "error"),
      parentRunId: text(row, "parent_run_id"),
      createdAt: number(row, "created_at"),
      updatedAt: number(row, "updated_at"),
      steps: steps.map(decodeStep),
    };
  }

  setRunStatus(
    id: string,
    status: EveFlowRun["status"],
    output: JsonObject = {},
    error = "",
  ): void {
    this.db
      .prepare("UPDATE flow_runs SET status=?,output_json=?,error=?,updated_at=? WHERE id=?")
      .run(status, JSON.stringify(output), error, Date.now(), id);
  }

  startStep(runId: string, stepId: string, input: JsonObject): number | undefined {
    const row = this.db
      .prepare(
        `UPDATE flow_step_runs SET status='running',attempt=attempt+1,started_at=?,ended_at=NULL,
         input_json=?,output_json='{}',error='' WHERE run_id=? AND step_id=? AND status='pending'
         RETURNING attempt`,
      )
      .get(Date.now(), JSON.stringify(input), runId, stepId) as Row | undefined;
    return row ? number(row, "attempt") : undefined;
  }

  acquireRunLease(runId: string, ownerId: string, leaseMs: number): boolean {
    const now = Date.now();
    return runTransaction(this.db, () => {
      this.db.prepare("DELETE FROM flow_run_leases WHERE lease_until<=?").run(now);
      const result = this.db
        .prepare(`INSERT OR IGNORE INTO flow_run_leases(run_id,owner_id,lease_until) VALUES(?,?,?)`)
        .run(runId, ownerId, now + Math.max(1_000, Math.trunc(leaseMs)));
      return Number(result.changes) === 1;
    });
  }

  renewRunLease(runId: string, ownerId: string, leaseMs: number): boolean {
    const result = this.db
      .prepare("UPDATE flow_run_leases SET lease_until=? WHERE run_id=? AND owner_id=?")
      .run(Date.now() + Math.max(1_000, Math.trunc(leaseMs)), runId, ownerId);
    return Number(result.changes) === 1;
  }

  releaseRunLease(runId: string, ownerId: string): void {
    this.db
      .prepare("DELETE FROM flow_run_leases WHERE run_id=? AND owner_id=?")
      .run(runId, ownerId);
  }

  finishStep(
    runId: string,
    stepId: string,
    status: EveFlowStepRun["status"],
    output: JsonObject,
    error = "",
  ): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE flow_step_runs SET status=?,ended_at=?,output_json=?,error=?,checkpoint_json=?
         WHERE run_id=? AND step_id=?`,
      )
      .run(
        status,
        now,
        JSON.stringify(output),
        error,
        JSON.stringify({ status, savedAt: now }),
        runId,
        stepId,
      );
    this.db.prepare("UPDATE flow_runs SET updated_at=? WHERE id=?").run(now, runId);
  }

  resetStep(runId: string, stepId: string): void {
    this.resetSteps(runId, [stepId]);
  }

  resetSteps(runId: string, stepIds: string[]): void {
    const uniqueStepIds = [...new Set(stepIds)];
    runTransaction(this.db, () => {
      const reset = this.db.prepare(
        `UPDATE flow_step_runs SET status='pending',started_at=NULL,ended_at=NULL,
         input_json='{}',output_json='{}',error='',checkpoint_json='{}'
         WHERE run_id=? AND step_id=?`,
      );
      for (const stepId of uniqueStepIds) {
        const result = reset.run(runId, stepId);
        if (Number(result.changes) !== 1) {
          throw new Error(`flow step not found: ${runId}/${stepId}`);
        }
      }
      this.db
        .prepare(
          "UPDATE flow_runs SET status='pending',output_json='{}',error='',updated_at=? WHERE id=?",
        )
        .run(Date.now(), runId);
    });
  }

  resumeStep(runId: string, stepId: string, value: unknown): void {
    const current = this.getRun(runId).steps.find((step) => step.stepId === stepId);
    if (current?.status !== "waiting") {
      throw new Error(`flow step is not waiting: ${runId}/${stepId}`);
    }
    this.finishStep(runId, stepId, "completed", { value, resumed: true });
  }

  copyStep(sourceRunId: string, targetRunId: string, stepId: string): void {
    const row = this.db
      .prepare("SELECT * FROM flow_step_runs WHERE run_id=? AND step_id=?")
      .get(sourceRunId, stepId) as Row | undefined;
    if (!row) {
      throw new Error(`flow step not found: ${sourceRunId}/${stepId}`);
    }
    this.db
      .prepare(
        `UPDATE flow_step_runs SET status=?,attempt=?,started_at=?,ended_at=?,input_json=?,output_json=?,error=?,checkpoint_json=?
         WHERE run_id=? AND step_id=?`,
      )
      .run(
        text(row, "status"),
        number(row, "attempt"),
        optionalNumber(row, "started_at") ?? null,
        optionalNumber(row, "ended_at") ?? null,
        text(row, "input_json"),
        text(row, "output_json"),
        text(row, "error"),
        JSON.stringify({ forkedFrom: sourceRunId }),
        targetRunId,
        stepId,
      );
  }

  status(): JsonObject {
    const counts = this.db
      .prepare("SELECT status,COUNT(*) count FROM flow_runs GROUP BY status")
      .all() as Row[];
    const latestIds = this.db
      .prepare("SELECT id FROM flow_runs ORDER BY updated_at DESC LIMIT 5")
      .all() as Row[];
    return {
      definitions: this.listDefinitions(),
      counts: Object.fromEntries(counts.map((row) => [text(row, "status"), number(row, "count")])),
      latest: latestIds.map((row) => this.getRun(text(row, "id"))),
    };
  }
}
