// Diffs API module exposes the plugin public contract.
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export {
  definePluginEntry,
  type AnyAgentTool,
  type EVEPluginApi,
  type EVEPluginConfigSchema,
  type EVEPluginToolContext,
  type PluginLogger,
} from "eve-agent/plugin-sdk/plugin-entry";
export { resolvePreferredEVETmpDir } from "eve-agent/plugin-sdk/temp-path";
