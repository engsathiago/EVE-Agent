// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "eve-agent/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "eve-agent/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "eve-agent/plugin-sdk/channel-send-result";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "eve-agent/plugin-sdk/runtime";
export type { WizardPrompter } from "eve-agent/plugin-sdk/setup";
