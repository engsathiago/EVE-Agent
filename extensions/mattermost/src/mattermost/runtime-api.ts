// Mattermost API module exposes the plugin public contract.
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChatType,
  HistoryEntry,
  EVEConfig,
  EVEPluginApi,
  ReplyPayload,
} from "eve-agent/plugin-sdk/core";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export { buildAgentMediaPayload } from "eve-agent/plugin-sdk/agent-media-payload";
export { resolveAllowlistMatchSimple } from "eve-agent/plugin-sdk/allow-from";
export { logInboundDrop } from "eve-agent/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export { logTypingFailure } from "eve-agent/plugin-sdk/channel-feedback";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
} from "eve-agent/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "eve-agent/plugin-sdk/models-provider-runtime";
export { isDangerousNameMatchingEnabled } from "eve-agent/plugin-sdk/dangerous-name-runtime";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export { resolveChannelMediaMaxBytes } from "eve-agent/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "eve-agent/plugin-sdk/outbound-media";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildInboundHistoryFromMap,
  buildPendingHistoryContextFromMap,
  recordPendingHistoryEntryIfEnabled,
} from "eve-agent/plugin-sdk/reply-history";
export { registerPluginHttpRoute } from "eve-agent/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "eve-agent/plugin-sdk/webhook-ingress";
export {
  isTrustedProxyAddress,
  parseStrictPositiveInteger,
  resolveClientIp,
} from "eve-agent/plugin-sdk/core";
export { parseTcpPort } from "eve-agent/plugin-sdk/number-runtime";
