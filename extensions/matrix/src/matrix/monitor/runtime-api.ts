// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "eve-agent/plugin-sdk/channel-inbound";
export type { PluginRuntime, RuntimeLogger } from "eve-agent/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "eve-agent/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "eve-agent/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "eve-agent/plugin-sdk/channel-outbound";
export { formatLocationText, toLocationContext } from "eve-agent/plugin-sdk/channel-inbound";
export { getAgentScopedMediaLocalRoots } from "eve-agent/plugin-sdk/agent-media-payload";
export { logInboundDrop } from "eve-agent/plugin-sdk/channel-inbound";
export { logTypingFailure } from "eve-agent/plugin-sdk/channel-outbound";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "eve-agent/plugin-sdk/channel-targets";
