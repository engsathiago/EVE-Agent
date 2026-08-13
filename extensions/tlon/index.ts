// Tlon plugin entrypoint registers its EVE integration.
import { defineBundledChannelEntry } from "eve-agent/plugin-sdk/channel-entry-contract";

export default defineBundledChannelEntry({
  id: "tlon",
  name: "Tlon",
  description: "Tlon/Urbit channel plugin",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "tlonPlugin",
  },
  runtime: {
    specifier: "./api.js",
    exportName: "setTlonRuntime",
  },
});
