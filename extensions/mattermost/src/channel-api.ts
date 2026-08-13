// Mattermost API module exposes the plugin public contract.
export { createAccountStatusSink } from "eve-agent/plugin-sdk/channel-outbound";
export type { ChannelPlugin } from "eve-agent/plugin-sdk/core";
export { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/core";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";
