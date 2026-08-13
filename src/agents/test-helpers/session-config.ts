/**
 * Session config fixtures.
 *
 * Shared builders for agent/session tests that need configured session scope.
 */
import type { EVEConfig } from "../../config/types.eve.js";

/** Builds a per-sender session config with optional targeted overrides. */
export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<EVEConfig["session"]>> = {},
): NonNullable<EVEConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
