// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  EVEConfig,
  EVEPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "eve-agent/plugin-sdk/core";
export type { EVEConfig as ClawdbotConfig } from "eve-agent/plugin-sdk/core";
export type RuntimeEnv = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
};
export type { GroupToolPolicyConfig } from "eve-agent/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "eve-agent/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "eve-agent/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "eve-agent/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "eve-agent/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "eve-agent/plugin-sdk/channel-outbound";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "eve-agent/plugin-sdk/context-visibility-runtime";
export {
  loadSessionStore,
  resolveSessionStoreEntry,
} from "eve-agent/plugin-sdk/session-store-runtime";
export { readJsonFileWithFallback } from "eve-agent/plugin-sdk/json-store";
export { normalizeAgentId } from "eve-agent/plugin-sdk/routing";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "eve-agent/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
