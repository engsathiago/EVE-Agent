// Private runtime barrel for the bundled Nostr extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export { getPluginRuntimeGatewayRequestScope } from "eve-agent/plugin-sdk/plugin-runtime";
export type { PluginRuntime } from "eve-agent/plugin-sdk/runtime-store";
