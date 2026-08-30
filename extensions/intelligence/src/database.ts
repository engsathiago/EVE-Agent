import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { configureSqliteConnectionPragmas } from "eve-agent/plugin-sdk/plugin-state-runtime";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";

const DB_RELATIVE_PATH = ["operations", "eve-operations.sqlite"] as const;
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

export type OperationsDatabase = {
  db: DatabaseSync;
  close: () => void;
};

export function resolveOperationsDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), ...DB_RELATIVE_PATH);
}

function chmodIfExists(target: string): void {
  try {
    fs.chmodSync(target, FILE_MODE);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "EPERM") {
      throw error;
    }
  }
}

function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS eve_operations_schema (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trace_runs (
      id TEXT PRIMARY KEY,
      run_key TEXT NOT NULL DEFAULT '',
      session_id TEXT NOT NULL DEFAULT '',
      session_key TEXT NOT NULL DEFAULT '',
      agent_id TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'running',
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      model_calls INTEGER NOT NULL DEFAULT 0,
      tool_calls INTEGER NOT NULL DEFAULT 0,
      retries INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS trace_runs_started_idx ON trace_runs(started_at DESC);
    CREATE INDEX IF NOT EXISTS trace_runs_session_idx ON trace_runs(session_key, started_at DESC);
    CREATE INDEX IF NOT EXISTS trace_runs_run_key_idx ON trace_runs(run_key, started_at DESC);

    CREATE TABLE IF NOT EXISTS trace_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES trace_runs(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      span_key TEXT NOT NULL DEFAULT '',
      parent_span_key TEXT NOT NULL DEFAULT '',
      occurred_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS trace_events_run_idx ON trace_events(run_id, occurred_at, id);

    CREATE TABLE IF NOT EXISTS result_items (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ready',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      UNIQUE(source_type, source_id)
    );
    CREATE INDEX IF NOT EXISTS result_items_status_idx ON result_items(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS result_artifacts (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES result_items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS result_artifacts_item_idx ON result_artifacts(item_id, name, version DESC);

    CREATE TABLE IF NOT EXISTS flow_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL,
      definition_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS flow_runs (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL REFERENCES flow_definitions(id),
      status TEXT NOT NULL DEFAULT 'pending',
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      parent_run_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS flow_runs_status_idx ON flow_runs(status, updated_at DESC);
    CREATE TABLE IF NOT EXISTS flow_run_definitions (
      run_id TEXT PRIMARY KEY REFERENCES flow_runs(id) ON DELETE CASCADE,
      flow_version INTEGER NOT NULL,
      definition_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS flow_run_leases (
      run_id TEXT PRIMARY KEY REFERENCES flow_runs(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL,
      lease_until INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS flow_step_runs (
      run_id TEXT NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER,
      ended_at INTEGER,
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      checkpoint_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY(run_id, step_id)
    );

    CREATE TABLE IF NOT EXISTS route_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_kind TEXT NOT NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      success INTEGER NOT NULL,
      quality REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      tool_success REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS route_observations_lookup_idx
      ON route_observations(task_kind, model, provider, created_at DESC);

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      baseline TEXT NOT NULL,
      candidate TEXT NOT NULL,
      traffic_percent REAL NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'draft',
      min_samples INTEGER NOT NULL DEFAULT 20,
      max_regression REAL NOT NULL DEFAULT 0.02,
      baseline_runs INTEGER NOT NULL DEFAULT 0,
      candidate_runs INTEGER NOT NULL DEFAULT 0,
      baseline_score REAL NOT NULL DEFAULT 0,
      candidate_score REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS worker_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      endpoint TEXT NOT NULL DEFAULT '',
      labels_json TEXT NOT NULL DEFAULT '[]',
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'offline',
      last_heartbeat INTEGER NOT NULL DEFAULT 0,
      active_jobs INTEGER NOT NULL DEFAULT 0,
      max_jobs INTEGER NOT NULL DEFAULT 1,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS worker_nodes_status_idx ON worker_nodes(status, last_heartbeat DESC);

    CREATE TABLE IF NOT EXISTS worker_jobs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      requirements_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'queued',
      priority INTEGER NOT NULL DEFAULT 0,
      worker_id TEXT NOT NULL DEFAULT '',
      lease_until INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      result_json TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS worker_jobs_queue_idx
      ON worker_jobs(status, priority DESC, created_at);

    CREATE TABLE IF NOT EXISTS managed_environments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      backend TEXT NOT NULL DEFAULT 'docker',
      container_id TEXT NOT NULL DEFAULT '',
      container_name TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'creating',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      ttl_minutes INTEGER NOT NULL,
      cpu REAL NOT NULL,
      memory_mb INTEGER NOT NULL,
      persistent INTEGER NOT NULL DEFAULT 0,
      network INTEGER NOT NULL DEFAULT 0,
      workspace TEXT NOT NULL DEFAULT '',
      exit_code INTEGER,
      runtime_error TEXT NOT NULL DEFAULT '',
      snapshots_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS managed_environments_status_idx
      ON managed_environments(status, expires_at);

    CREATE TABLE IF NOT EXISTS studio_artifacts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      kind TEXT NOT NULL,
      media_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      published_result_id TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS studio_artifacts_updated_idx
      ON studio_artifacts(updated_at DESC);

    CREATE TABLE IF NOT EXISTS studio_versions (
      artifact_id TEXT NOT NULL REFERENCES studio_artifacts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(artifact_id, version)
    );
  `);
  db.prepare("INSERT OR IGNORE INTO eve_operations_schema(version, applied_at) VALUES(1, ?)").run(
    Date.now(),
  );
}

export function openOperationsDatabase(
  dbPath = resolveOperationsDatabasePath(),
): OperationsDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: DIRECTORY_MODE });
  if (!fs.existsSync(dbPath)) {
    fs.closeSync(fs.openSync(dbPath, "a", FILE_MODE));
  }
  const db = new DatabaseSync(dbPath);
  let maintenance: ReturnType<typeof configureSqliteConnectionPragmas> | undefined;
  try {
    maintenance = configureSqliteConnectionPragmas(db, {
      busyTimeoutMs: 15_000,
      checkpointIntervalMs: 0,
      databaseLabel: "EVE operations database",
      databasePath: dbPath,
      foreignKeys: true,
      synchronous: "NORMAL",
    });
    ensureSchema(db);
    fs.chmodSync(path.dirname(dbPath), DIRECTORY_MODE);
    for (const target of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`]) {
      chmodIfExists(target);
    }
    return {
      db,
      close: () => {
        maintenance?.close();
        db.close();
      },
    };
  } catch (error) {
    maintenance?.close();
    db.close();
    throw error;
  }
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string" || !value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export function runTransaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
