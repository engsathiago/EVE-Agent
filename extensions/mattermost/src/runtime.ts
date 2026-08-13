// Mattermost plugin module implements runtime behavior.
import { createPluginRuntimeStore } from "eve-agent/plugin-sdk/runtime-store";
import type { PluginRuntime } from "eve-agent/plugin-sdk/runtime-store";

const { setRuntime: setMattermostRuntime, getRuntime: getMattermostRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "mattermost",
    errorMessage: "Mattermost runtime not initialized",
  });
export { getMattermostRuntime, setMattermostRuntime };
