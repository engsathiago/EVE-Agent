// Agent database path helpers resolve per-agent persisted database paths.
import path from "node:path";
import { normalizeAgentId } from "../routing/session-key.js";
import { resolveEVEStateSqliteDir } from "./eve-state-db.paths.js";

/**
 * Path helpers for per-agent SQLite state.
 *
 * Agent databases live beside the shared state database root so each agent can
 * own private runtime tables while the shared registry can still discover them.
 */
/** Inputs for resolving one agent SQLite path or directory. */
export type EVEAgentSqlitePathOptions = {
  agentId: string;
  env?: NodeJS.ProcessEnv;
  path?: string;
};

/** Resolve the SQLite file for one normalized agent id. */
export function resolveEVEAgentSqlitePath(options: EVEAgentSqlitePathOptions): string {
  const agentId = normalizeAgentId(options.agentId);
  return path.resolve(
    options.path ??
      path.join(
        path.dirname(resolveEVEStateSqliteDir(options.env ?? process.env)),
        "agents",
        agentId,
        "agent",
        "eve-agent.sqlite",
      ),
  );
}
