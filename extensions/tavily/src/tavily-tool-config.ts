// Tavily helper module supports tavily tool config behavior.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import type { EVEPluginToolContext } from "eve-agent/plugin-sdk/plugin-entry";
import type { EVEPluginApi } from "eve-agent/plugin-sdk/plugin-runtime";

export type TavilyToolConfigContext = Pick<
  EVEPluginToolContext,
  "config" | "runtimeConfig" | "getRuntimeConfig"
>;

export function resolveTavilyToolConfig(
  api: EVEPluginApi,
  ctx?: TavilyToolConfigContext,
): EVEConfig {
  return ctx?.getRuntimeConfig?.() ?? ctx?.runtimeConfig ?? ctx?.config ?? api.config;
}
