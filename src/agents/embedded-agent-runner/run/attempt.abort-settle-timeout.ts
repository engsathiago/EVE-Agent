/**
 * Resolves how long aborted attempts wait for cleanup to settle.
 */
import { parseStrictPositiveInteger } from "../../../infra/parse-finite-number.js";

type AbortSettleTimeoutEnv = Partial<
  Pick<NodeJS.ProcessEnv, "EVE_EMBEDDED_ABORT_SETTLE_TIMEOUT_MS" | "EVE_TEST_FAST">
>;

/**
 * Resolves how long embedded-run cleanup waits for abort side effects to settle.
 * The explicit env override is strict decimal milliseconds; invalid values fall
 * back to the normal/test defaults instead of silently widening cleanup waits.
 */
export function resolveEmbeddedAbortSettleTimeoutMs(
  env: AbortSettleTimeoutEnv = process.env,
): number {
  const override = parseStrictPositiveInteger(env.EVE_EMBEDDED_ABORT_SETTLE_TIMEOUT_MS);
  if (override !== undefined) {
    return override;
  }
  return env.EVE_TEST_FAST === "1" ? 250 : 2_000;
}
