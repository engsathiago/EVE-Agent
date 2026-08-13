// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "eve-agent/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "eve-agent/plugin-sdk/channel-contract";
export { logInboundDrop } from "eve-agent/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  EVEConfig,
} from "eve-agent/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export type { OutboundReplyPayload } from "eve-agent/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "eve-agent/plugin-sdk/reply-payload";
export type { PluginRuntime } from "eve-agent/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export type { SecretInput } from "eve-agent/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "eve-agent/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
