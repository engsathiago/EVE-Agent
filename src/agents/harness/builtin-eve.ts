/**
 * Built-in EVE harness registration.
 *
 * Harness selection uses this factory to expose the embedded EVE runtime
 * through the same AgentHarness contract as external harness plugins.
 */
import { EVE_EMBEDDED_CONTEXT_ENGINE_HOST } from "../../context-engine/host-compat.js";
import { runEmbeddedAttempt } from "../embedded-agent-runner/run/attempt.js";
import type { AgentHarness } from "./types.js";

/** Creates the built-in harness backed by the embedded EVE agent runner. */
export function createEVEAgentHarness(): AgentHarness {
  return {
    id: "eve",
    label: "EVE embedded agent",
    contextEngineHostCapabilities: EVE_EMBEDDED_CONTEXT_ENGINE_HOST.capabilities,
    supports: () => ({ supported: true, priority: 0 }),
    runAttempt: runEmbeddedAttempt,
  };
}
