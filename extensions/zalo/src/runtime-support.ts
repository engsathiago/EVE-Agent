// Zalo plugin module implements runtime support behavior.
export type { ReplyPayload } from "eve-agent/plugin-sdk/reply-runtime";
export type { EVEConfig, GroupPolicy } from "eve-agent/plugin-sdk/config-contracts";
export type { MarkdownTableMode } from "eve-agent/plugin-sdk/config-contracts";
export type { BaseTokenResolution } from "eve-agent/plugin-sdk/channel-contract";
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "eve-agent/plugin-sdk/channel-contract";
export type { SecretInput } from "eve-agent/plugin-sdk/secret-input";
export type { ChannelPlugin, PluginRuntime, WizardPrompter } from "eve-agent/plugin-sdk/core";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export type { OutboundReplyPayload } from "eve-agent/plugin-sdk/reply-payload";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  formatPairingApproveHint,
  jsonResult,
  normalizeAccountId,
  readStringParam,
  resolveClientIp,
} from "eve-agent/plugin-sdk/core";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  buildSingleChannelSecretPromptState,
  mergeAllowFromEntries,
  migrateBaseNameToDefaultAccount,
  promptSingleChannelSecretInput,
  runSingleChannelSecretStep,
  setTopLevelChannelDmPolicyWithAllowFrom,
} from "eve-agent/plugin-sdk/setup";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "eve-agent/plugin-sdk/secret-input";
export {
  buildTokenChannelStatusSummary,
  PAIRING_APPROVED_MESSAGE,
} from "eve-agent/plugin-sdk/channel-status";
export { buildBaseAccountStatusSnapshot } from "eve-agent/plugin-sdk/status-helpers";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
export {
  formatAllowFromLowercase,
  isNormalizedSenderAllowed,
} from "eve-agent/plugin-sdk/allow-from";
export { addWildcardAllowFrom } from "eve-agent/plugin-sdk/setup";
export { resolveOpenProviderRuntimeGroupPolicy } from "eve-agent/plugin-sdk/runtime-group-policy";
export {
  warnMissingProviderGroupPolicyFallbackOnce,
  resolveDefaultGroupPolicy,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export { logTypingFailure } from "eve-agent/plugin-sdk/channel-feedback";
export {
  deliverTextOrMediaReply,
  isNumericTargetId,
  sendPayloadWithChunkedTextAndMedia,
} from "eve-agent/plugin-sdk/reply-payload";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "eve-agent/plugin-sdk/inbound-envelope";
export { waitForAbortSignal } from "eve-agent/plugin-sdk/runtime";
export {
  applyBasicWebhookRequestGuards,
  createFixedWindowRateLimiter,
  createWebhookAnomalyTracker,
  readJsonWebhookBodyOrReject,
  registerPluginHttpRoute,
  registerWebhookTarget,
  registerWebhookTargetWithPluginRoute,
  resolveWebhookPath,
  resolveWebhookTargetWithAuthOrRejectSync,
  WEBHOOK_ANOMALY_COUNTER_DEFAULTS,
  WEBHOOK_RATE_LIMIT_DEFAULTS,
  withResolvedWebhookRequestPipeline,
} from "eve-agent/plugin-sdk/webhook-ingress";
export type {
  RegisterWebhookPluginRouteOptions,
  RegisterWebhookTargetOptions,
} from "eve-agent/plugin-sdk/webhook-ingress";
