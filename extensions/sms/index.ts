// Sms plugin entrypoint registers its EVE integration.
import { defineBundledChannelEntry } from "eve-agent/plugin-sdk/channel-entry-contract";

export default defineBundledChannelEntry({
  id: "sms",
  name: "SMS",
  description: "Twilio SMS channel plugin for EVE text messages.",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "smsPlugin",
  },
  runtime: {
    specifier: "./api.js",
    exportName: "setSmsRuntime",
  },
});
