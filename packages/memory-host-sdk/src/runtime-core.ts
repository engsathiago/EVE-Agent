// Focused runtime contract for memory plugin config/state/helpers.

export type { AnyAgentTool } from "./host/eve-runtime-agent.js";
export { resolveCronStyleNow } from "./host/eve-runtime-agent.js";
export { DEFAULT_AGENT_COMPACTION_RESERVE_TOKENS_FLOOR } from "./host/eve-runtime-agent.js";
export { resolveDefaultAgentId, resolveSessionAgentId } from "./host/eve-runtime-agent.js";
export { resolveMemorySearchConfig } from "./host/eve-runtime-agent.js";
export {
  asToolParamsRecord,
  jsonResult,
  readNumberParam,
  readStringParam,
} from "./host/eve-runtime-agent.js";
export { SILENT_REPLY_TOKEN } from "./host/eve-runtime-session.js";
export { parseNonNegativeByteSize } from "./host/eve-runtime-config.js";
export {
  getRuntimeConfig,
  /** @deprecated Use getRuntimeConfig(), or pass the already loaded config through the call path. */
  loadConfig,
} from "./host/eve-runtime-config.js";
export { resolveStateDir } from "./host/eve-runtime-config.js";
export { resolveSessionTranscriptsDirForAgent } from "./host/eve-runtime-config.js";
export { emptyPluginConfigSchema } from "./host/eve-runtime-memory.js";
export {
  buildActiveMemoryPromptSection,
  getMemoryCapabilityRegistration,
  listActiveMemoryPublicArtifacts,
} from "./host/eve-runtime-memory.js";
export { parseAgentSessionKey } from "./host/eve-runtime-agent.js";
export type { EVEConfig } from "./host/eve-runtime-config.js";
export type { MemoryCitationsMode } from "./host/eve-runtime-config.js";
export type {
  MemoryFlushPlan,
  MemoryFlushPlanResolver,
  MemoryPluginCapability,
  MemoryPluginPublicArtifact,
  MemoryPluginPublicArtifactsProvider,
  MemoryPluginRuntime,
  MemoryPromptSectionBuilder,
} from "./host/eve-runtime-memory.js";
export type { EVEPluginApi } from "./host/eve-runtime-memory.js";
