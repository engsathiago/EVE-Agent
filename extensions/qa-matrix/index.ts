// Qa Matrix plugin entrypoint registers its EVE integration.
import { definePluginEntry } from "eve-agent/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "qa-matrix",
  name: "QA Matrix",
  description: "Matrix QA transport runner and substrate",
  register() {},
});
