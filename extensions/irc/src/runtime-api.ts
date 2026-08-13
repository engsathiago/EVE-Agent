// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "eve-agent/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "eve-agent/plugin-sdk/channel-core";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export type { PluginRuntime } from "eve-agent/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "eve-agent/plugin-sdk/config-contracts";
export type { OutboundReplyPayload } from "eve-agent/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "eve-agent/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "eve-agent/plugin-sdk/channel-status";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "eve-agent/plugin-sdk/channel-outbound";
export { resolveControlCommandGate } from "eve-agent/plugin-sdk/command-auth-native";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "eve-agent/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "eve-agent/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "eve-agent/plugin-sdk/channel-inbound";
