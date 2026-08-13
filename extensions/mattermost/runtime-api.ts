// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  EVEConfig,
  EVEPluginApi,
  PluginRuntime,
} from "eve-agent/plugin-sdk/core";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export type { ReplyPayload } from "eve-agent/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "eve-agent/plugin-sdk/models-provider-runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "eve-agent/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "eve-agent/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "eve-agent/plugin-sdk/channel-status";
export { createAccountStatusSink } from "eve-agent/plugin-sdk/channel-outbound";
export { buildAgentMediaPayload } from "eve-agent/plugin-sdk/agent-media-payload";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "eve-agent/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "eve-agent/plugin-sdk/models-provider-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "eve-agent/plugin-sdk/dangerous-name-runtime";
export { loadSessionStore, resolveStorePath } from "eve-agent/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "eve-agent/plugin-sdk/channel-inbound";
export { logInboundDrop } from "eve-agent/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export { logTypingFailure } from "eve-agent/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "eve-agent/plugin-sdk/outbound-media";
export { rawDataToString } from "eve-agent/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "eve-agent/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "eve-agent/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "eve-agent/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "eve-agent/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "eve-agent/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "eve-agent/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "eve-agent/plugin-sdk/media-runtime";
export { normalizeProviderId } from "eve-agent/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
