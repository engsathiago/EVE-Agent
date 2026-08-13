/** Detects whether a daemon was launched by EVE's container-aware service wrapper. */
import { normalizeOptionalString } from "@eve/normalization-core/string-coerce";

/** Resolves the daemon container hint exposed by managed service environments. */
export function resolveDaemonContainerContext(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return (
    normalizeOptionalString(env.EVE_CONTAINER_HINT) ||
    normalizeOptionalString(env.EVE_CONTAINER) ||
    null
  );
}
