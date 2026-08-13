// Whatsapp plugin entrypoint registers its EVE integration.
import { defineBundledChannelEntry } from "eve-agent/plugin-sdk/channel-entry-contract";

export default defineBundledChannelEntry({
  id: "whatsapp",
  name: "WhatsApp",
  description: "WhatsApp channel plugin",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "whatsappPlugin",
  },
  runtime: {
    specifier: "./runtime-setter-api.js",
    exportName: "setWhatsAppRuntime",
  },
});
