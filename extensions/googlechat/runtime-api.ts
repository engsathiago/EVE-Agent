// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "eve-agent/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "eve-agent/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "eve-agent/plugin-sdk/channel-contract";
export { missingTargetError } from "eve-agent/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "eve-agent/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export { PAIRING_APPROVED_MESSAGE } from "eve-agent/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export { GoogleChatConfigSchema } from "eve-agent/plugin-sdk/bundled-channel-config-schema";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "eve-agent/plugin-sdk/dangerous-name-runtime";
export {
  readRemoteMediaBuffer,
  resolveChannelMediaMaxBytes,
} from "eve-agent/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "eve-agent/plugin-sdk/outbound-media";
export type { PluginRuntime } from "eve-agent/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "eve-agent/plugin-sdk/ssrf-runtime";
export type {
  GoogleChatAccountConfig,
  GoogleChatConfig,
} from "eve-agent/plugin-sdk/config-contracts";
export { extractToolSend } from "eve-agent/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "eve-agent/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "eve-agent/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "eve-agent/plugin-sdk/webhook-ingress";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "eve-agent/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "eve-agent/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
