// Open Prose plugin entrypoint registers its EVE integration.
import { definePluginEntry, type EVEPluginApi } from "./runtime-api.js";

export default definePluginEntry({
  id: "open-prose",
  name: "OpenProse",
  description: "Plugin-shipped prose skills bundle",
  register(_api: EVEPluginApi) {
    // OpenProse is delivered via plugin-shipped skills.
  },
});
