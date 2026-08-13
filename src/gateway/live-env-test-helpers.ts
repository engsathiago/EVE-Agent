/**
 * Environment snapshot helpers for live gateway tests.
 */
import { deleteTestEnvValue, setTestEnvValue } from "../test-utils/env.js";

const COMMON_LIVE_ENV_NAMES = [
  "EVE_AGENT_RUNTIME",
  "EVE_CONFIG_PATH",
  "EVE_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "EVE_SKIP_BROWSER_CONTROL_SERVER",
  "EVE_SKIP_CANVAS_HOST",
  "EVE_SKIP_CHANNELS",
  "EVE_SKIP_CRON",
  "EVE_SKIP_GMAIL_WATCHER",
  "EVE_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

/** Captures live-test environment variables so tests can restore them later. */
export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

/** Restores a previously captured live-test environment snapshot. */
export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      deleteTestEnvValue(name);
    } else {
      setTestEnvValue(name, value);
    }
  }
}
