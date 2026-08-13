// Signal plugin entrypoint registers its EVE integration.
import { defineBundledChannelEntry } from "eve-agent/plugin-sdk/channel-entry-contract";

export default defineBundledChannelEntry({
  id: "signal",
  name: "Signal",
  description: "Signal channel plugin",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "signalPlugin",
  },
  runtime: {
    specifier: "./runtime-api.js",
    exportName: "setSignalRuntime",
  },
});
