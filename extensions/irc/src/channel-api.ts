// Irc API module exposes the plugin public contract.
export { createAccountStatusSink } from "eve-agent/plugin-sdk/channel-outbound";
export { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/account-id";
export type { ChannelPlugin } from "eve-agent/plugin-sdk/channel-core";
export { PAIRING_APPROVED_MESSAGE } from "eve-agent/plugin-sdk/channel-status";
export { buildBaseChannelStatusSummary } from "eve-agent/plugin-sdk/status-helpers";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
