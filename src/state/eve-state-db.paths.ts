// State database path helpers resolve shared EVE state DB paths.
import os from "node:os";
import path from "node:path";
import { isMainThread, threadId } from "node:worker_threads";
import { resolveStateDir } from "../config/paths.js";
import { parseStrictNonNegativeInteger } from "../infra/parse-finite-number.js";

/**
 * Path helpers for the shared EVE SQLite state database.
 *
 * Tests get worker-scoped temp state roots unless they explicitly provide
 * `EVE_STATE_DIR`, which prevents parallel Vitest workers from sharing WAL files.
 */
function resolveEVEStateRootDir(env: NodeJS.ProcessEnv): string {
  if (env.EVE_STATE_DIR?.trim()) {
    return resolveStateDir(env);
  }
  if (env.VITEST || env.NODE_ENV === "test") {
    const workerId = parseStrictNonNegativeInteger(
      env.VITEST_WORKER_ID ?? env.VITEST_POOL_ID ?? "",
    );
    const shardSuffix =
      workerId !== undefined
        ? `${process.pid}-${workerId}`
        : isMainThread
          ? String(process.pid)
          : `${process.pid}-${threadId}`;
    return path.join(os.tmpdir(), "eve-test-state", shardSuffix);
  }
  return resolveStateDir(env);
}

/** Resolve the directory that contains the shared state SQLite file. */
export function resolveEVEStateSqliteDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveEVEStateRootDir(env), "state");
}

/** Resolve the shared state SQLite file path. */
export function resolveEVEStateSqlitePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveEVEStateSqliteDir(env), "eve.sqlite");
}
