// Env log level helpers normalize log level values from environment variables.
import { normalizeOptionalString } from "@eve/normalization-core/string-coerce";
import { ALLOWED_LOG_LEVELS, type LogLevel, tryParseLogLevel } from "./levels.js";
import { loggingState } from "./state.js";

/** Resolves EVE_LOG_LEVEL once per value, warning only when the invalid value changes. */
export function resolveEnvLogLevelOverride(): LogLevel | undefined {
  const trimmed = normalizeOptionalString(process.env.EVE_LOG_LEVEL) ?? "";
  if (!trimmed) {
    loggingState.invalidEnvLogLevelValue = null;
    return undefined;
  }
  const parsed = tryParseLogLevel(trimmed);
  if (parsed) {
    loggingState.invalidEnvLogLevelValue = null;
    return parsed;
  }
  if (loggingState.invalidEnvLogLevelValue !== trimmed) {
    loggingState.invalidEnvLogLevelValue = trimmed;
    process.stderr.write(
      `[eve] Ignoring invalid EVE_LOG_LEVEL="${trimmed}" (allowed: ${ALLOWED_LOG_LEVELS.join("|")}).\n`,
    );
  }
  return undefined;
}
