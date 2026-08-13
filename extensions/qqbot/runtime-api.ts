// Qqbot API module exposes the plugin public contract.
export type { ChannelPlugin, EVEPluginApi, PluginRuntime } from "eve-agent/plugin-sdk/core";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export type {
  EVEPluginService,
  EVEPluginServiceContext,
  PluginLogger,
} from "eve-agent/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/bridge/runtime.js";
