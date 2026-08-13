// Android node capability policy config fixture describes gateway policy config.
import type { EVEConfig } from "../../../src/config/config.js";

// Test helper for unwrapping gateway config.get response shapes.

/** Narrow unknown payloads to plain records for fixture parsing. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

/** Unwrap current and legacy remote config snapshot envelopes. */
export function unwrapRemoteConfigSnapshot(raw: unknown): EVEConfig {
  const rawObj = asRecord(raw);
  const resolved = asRecord(rawObj.resolved);
  if (Object.keys(resolved).length > 0) {
    return resolved as EVEConfig;
  }

  const wrapped = asRecord(rawObj.config);
  if (Object.keys(wrapped).length > 0) {
    return wrapped as EVEConfig;
  }

  const legacyPayload = asRecord(rawObj.payload);
  const legacyResolved = asRecord(legacyPayload.resolved);
  if (Object.keys(legacyResolved).length > 0) {
    return legacyResolved as EVEConfig;
  }

  const legacyConfig = asRecord(legacyPayload.config);
  if (Object.keys(legacyConfig).length > 0) {
    return legacyConfig as EVEConfig;
  }

  if (Object.keys(rawObj).length > 0 && !Object.hasOwn(rawObj, "payload")) {
    return rawObj as EVEConfig;
  }

  throw new Error("remote gateway config.get returned empty config payload");
}
