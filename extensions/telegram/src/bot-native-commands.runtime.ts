// Telegram plugin module implements bot native commands behavior.
export {
  ensureConfiguredBindingRouteReady,
  recordInboundSessionMetaSafe,
} from "eve-agent/plugin-sdk/conversation-runtime";
export { getAgentScopedMediaLocalRoots } from "eve-agent/plugin-sdk/media-runtime";
export {
  executePluginCommand,
  getPluginCommandSpecs,
  matchPluginCommand,
} from "eve-agent/plugin-sdk/plugin-runtime";
export {
  finalizeInboundContext,
  resolveChunkMode,
} from "eve-agent/plugin-sdk/reply-dispatch-runtime";
export { resolveThreadSessionKeys } from "eve-agent/plugin-sdk/routing";
export { getSessionEntry } from "eve-agent/plugin-sdk/session-store-runtime";
