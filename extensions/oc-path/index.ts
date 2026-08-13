// OC Path plugin entrypoint registers its EVE integration.
import { definePluginEntry } from "eve-agent/plugin-sdk/plugin-entry";
import { registerOcPathCli } from "./cli-registration.js";

export default definePluginEntry({
  id: "oc-path",
  name: "OC Path",
  description: "Adds the eve path CLI for oc:// workspace file addressing.",
  register(api) {
    registerOcPathCli(api);
  },
});
