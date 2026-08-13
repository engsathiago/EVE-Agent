// Real workspace contract for memory engine foundation concerns.

export {
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
} from "./host/eve-runtime-agent.js";
export {
  resolveMemorySearchConfig,
  resolveMemorySearchSyncConfig,
  type ResolvedMemorySearchConfig,
  type ResolvedMemorySearchSyncConfig,
} from "./host/eve-runtime-agent.js";
export { parseDurationMs } from "./host/eve-runtime-config.js";
export { loadConfig } from "./host/eve-runtime-config.js";
export { resolveStateDir } from "./host/eve-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/eve-runtime-config.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "./host/eve-runtime-config.js";
export { root } from "./host/eve-runtime-io.js";
export { isPathInside } from "./host/fs-utils.js";
export { createSubsystemLogger } from "./host/eve-runtime-io.js";
export { detectMime } from "./host/eve-runtime-io.js";
export { resolveGlobalSingleton } from "./host/eve-runtime-io.js";
export { onSessionTranscriptUpdate } from "./host/eve-runtime-session.js";
export { splitShellArgs } from "./host/eve-runtime-io.js";
export { runTasksWithConcurrency } from "./host/eve-runtime-io.js";
export {
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
} from "./host/eve-runtime-io.js";
export type { EVEConfig } from "./host/eve-runtime-config.js";
export type { SessionSendPolicyConfig } from "./host/eve-runtime-config.js";
export type { SecretInput } from "./host/eve-runtime-config.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "./host/eve-runtime-config.js";
export type { MemorySearchConfig } from "./host/eve-runtime-config.js";
