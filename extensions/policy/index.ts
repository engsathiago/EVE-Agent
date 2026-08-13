// EVE policy plugin entrypoint.
import { definePluginEntry } from "eve-agent/plugin-sdk/plugin-entry";
import { registerPolicyCli } from "./src/cli.js";

export default definePluginEntry({
  id: "policy",
  name: "EVE Policy",
  description: "Empty first-party policy contract reserved for EVE-owned rules.",
  register(api) {
    api.registerCli(
      async ({ program }) => {
        registerPolicyCli(program);
      },
      {
        descriptors: [
          {
            name: "policy",
            description: "Inspect the EVE policy contract",
            hasSubcommands: true,
          },
        ],
      },
    );
  },
});
