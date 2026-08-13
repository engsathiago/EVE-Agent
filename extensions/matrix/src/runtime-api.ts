// Matrix API module exposes the plugin public contract.
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "eve-agent/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  ToolAuthorizationError,
} from "eve-agent/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "eve-agent/plugin-sdk/channel-config-primitives";
export type { ChannelPlugin } from "eve-agent/plugin-sdk/channel-core";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelOutboundAdapter,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelToolSend,
} from "eve-agent/plugin-sdk/channel-contract";
export {
  formatLocationText,
  toLocationContext,
  type NormalizedLocation,
} from "eve-agent/plugin-sdk/channel-inbound";
export { logInboundDrop } from "eve-agent/plugin-sdk/channel-inbound";
export { logTypingFailure } from "eve-agent/plugin-sdk/channel-outbound";
export { resolveAckReaction } from "eve-agent/plugin-sdk/channel-feedback";
export type { ChannelSetupInput } from "eve-agent/plugin-sdk/setup";
export type {
  EVEConfig,
  ContextVisibilityMode,
  DmPolicy,
  GroupPolicy,
} from "eve-agent/plugin-sdk/config-contracts";
export type { GroupToolPolicyConfig } from "eve-agent/plugin-sdk/config-contracts";
export type { WizardPrompter } from "eve-agent/plugin-sdk/setup";
export type { SecretInput } from "eve-agent/plugin-sdk/secret-input";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput,
  mergeAllowFromEntries,
  moveSingleAccountChannelSectionToDefaultAccount,
  promptAccountId,
  promptChannelAccessConfig,
  splitSetupEntries,
} from "eve-agent/plugin-sdk/setup";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export {
  assertHttpUrlTargetsPrivateNetwork,
  closeDispatcher,
  createPinnedDispatcher,
  isPrivateOrLoopbackHost,
  resolvePinnedHostnameWithPolicy,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
  type LookupFn,
  type SsrFPolicy,
} from "eve-agent/plugin-sdk/ssrf-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "eve-agent/plugin-sdk/channel-inbound";
export {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "eve-agent/plugin-sdk/acp-binding-runtime";
export {
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  PAIRING_APPROVED_MESSAGE,
} from "eve-agent/plugin-sdk/channel-status";
export {
  getSessionBindingService,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
} from "eve-agent/plugin-sdk/conversation-runtime";
export { resolveOutboundSendDep } from "eve-agent/plugin-sdk/channel-outbound";
export { resolveAgentIdFromSessionKey } from "eve-agent/plugin-sdk/routing";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
export { createChannelMessageReplyPipeline } from "eve-agent/plugin-sdk/channel-outbound";
export { loadOutboundMediaFromUrl } from "eve-agent/plugin-sdk/outbound-media";
export { normalizePollInput, type PollInput } from "eve-agent/plugin-sdk/poll-runtime";
export { writeJsonFileAtomically } from "eve-agent/plugin-sdk/json-store";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "eve-agent/plugin-sdk/channel-targets";
export { buildTimeoutAbortSignal } from "./matrix/sdk/timeout-abort-signal.js";
export { formatZonedTimestamp } from "eve-agent/plugin-sdk/time-runtime";
export type { PluginRuntime, RuntimeLogger } from "eve-agent/plugin-sdk/plugin-runtime";
export type { ReplyPayload } from "eve-agent/plugin-sdk/reply-runtime";
// resolveMatrixAccountStringValues already comes from the Matrix API barrel.
// Re-exporting auth-precedence here makes TS source loaders define the export twice.
