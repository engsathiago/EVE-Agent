// Twitch plugin entrypoint registers its EVE integration.
import { defineBundledChannelEntry } from "eve-agent/plugin-sdk/channel-entry-contract";

export default defineBundledChannelEntry({
  id: "twitch",
  name: "Twitch",
  description: "Twitch IRC chat channel plugin",
  importMetaUrl: import.meta.url,
  plugin: {
    specifier: "./channel-plugin-api.js",
    exportName: "twitchPlugin",
  },
  runtime: {
    specifier: "./api.js",
    exportName: "setTwitchRuntime",
  },
});
