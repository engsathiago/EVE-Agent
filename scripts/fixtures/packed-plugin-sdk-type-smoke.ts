// Packed Plugin Sdk Type Smoke script supports EVE repository automation.
type PublicPluginSdkModules = [
  typeof import("eve-agent/plugin-sdk"),
  typeof import("eve-agent/plugin-sdk/channel-entry-contract"),
  typeof import("eve-agent/plugin-sdk/config-contracts"),
  typeof import("eve-agent/plugin-sdk/provider-entry"),
  typeof import("eve-agent/plugin-sdk/runtime-env"),
];

const resolvedModules = null as unknown as PublicPluginSdkModules;

void resolvedModules;
