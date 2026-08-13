// Feishu API module exposes the plugin public contract.
export type {
  ChannelMessageActionName,
  ChannelMeta,
  ChannelPlugin,
  ClawdbotConfig,
} from "../runtime-api.js";

export { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/account-resolution";
export { createActionGate } from "eve-agent/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "eve-agent/plugin-sdk/channel-config-primitives";
export {
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "eve-agent/plugin-sdk/status-helpers";
export { PAIRING_APPROVED_MESSAGE } from "eve-agent/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
