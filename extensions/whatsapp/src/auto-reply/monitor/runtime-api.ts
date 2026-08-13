// Whatsapp API module exposes the plugin public contract.
export { resolveIdentityNamePrefix } from "eve-agent/plugin-sdk/agent-runtime";
export { formatInboundEnvelope } from "eve-agent/plugin-sdk/channel-inbound";
export { resolveInboundSessionEnvelopeContext } from "eve-agent/plugin-sdk/channel-inbound";
export { toLocationContext } from "eve-agent/plugin-sdk/channel-inbound";
export {
  createChannelMessageReplyPipeline,
  resolveChannelMessageSourceReplyDeliveryMode,
} from "eve-agent/plugin-sdk/channel-outbound";
export {
  isControlCommandMessage,
  shouldComputeCommandAuthorized,
} from "eve-agent/plugin-sdk/command-detection";
export { resolveChannelContextVisibilityMode } from "../config.runtime.js";
export { getAgentScopedMediaLocalRoots } from "eve-agent/plugin-sdk/media-runtime";
export type LoadConfigFn = typeof import("../config.runtime.js").getRuntimeConfig;
export {
  buildHistoryContextFromEntries,
  type HistoryEntry,
} from "eve-agent/plugin-sdk/reply-history";
export { resolveSendableOutboundReplyParts } from "eve-agent/plugin-sdk/reply-payload";
export {
  dispatchReplyWithBufferedBlockDispatcher,
  finalizeInboundContext,
  resolveChunkMode,
  resolveTextChunkLimit,
  type getReplyFromConfig,
  type ReplyPayload,
} from "eve-agent/plugin-sdk/reply-runtime";
export {
  resolveInboundLastRouteSessionKey,
  type resolveAgentRoute,
} from "eve-agent/plugin-sdk/routing";
export { logVerbose, shouldLogVerbose, type getChildLogger } from "eve-agent/plugin-sdk/runtime-env";
export { resolvePinnedMainDmOwnerFromAllowlist } from "eve-agent/plugin-sdk/security-runtime";
export { resolveMarkdownTableMode } from "eve-agent/plugin-sdk/markdown-table-runtime";
export { jidToE164, normalizeE164 } from "../../text-runtime.js";
