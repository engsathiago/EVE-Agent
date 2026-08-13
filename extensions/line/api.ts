// Line API module exposes the plugin public contract.
export type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  EVEConfig,
  EVEPluginApi,
  PluginRuntime,
} from "eve-agent/plugin-sdk/core";
export type { ReplyPayload } from "eve-agent/plugin-sdk/reply-runtime";
export type { ResolvedLineAccount } from "./runtime-api.js";
export { linePlugin } from "./src/channel.js";
export { lineSetupPlugin } from "./src/channel.setup.js";
