// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/account-id";
export type { AllowlistMatch } from "eve-agent/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "eve-agent/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "eve-agent/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "eve-agent/plugin-sdk/channel-core";
export { logTypingFailure } from "eve-agent/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export { resolveToolsBySender } from "eve-agent/plugin-sdk/channel-policy";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "eve-agent/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "eve-agent/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsCloudName,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  EVEConfig,
} from "eve-agent/plugin-sdk/config-contracts";
export { isDangerousNameMatchingEnabled } from "eve-agent/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "eve-agent/plugin-sdk/runtime-group-policy";
export { withFileLock } from "eve-agent/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "eve-agent/plugin-sdk/channel-outbound";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "eve-agent/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "eve-agent/plugin-sdk/channel-inbound";
export { loadOutboundMediaFromUrl } from "eve-agent/plugin-sdk/outbound-media";
export { buildMediaPayload } from "eve-agent/plugin-sdk/reply-payload";
export type { ReplyPayload } from "eve-agent/plugin-sdk/reply-payload";
export type { PluginRuntime } from "eve-agent/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export type { SsrFPolicy } from "eve-agent/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "eve-agent/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "eve-agent/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "eve-agent/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
