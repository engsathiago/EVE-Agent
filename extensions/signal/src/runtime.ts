// Signal plugin module implements runtime behavior.
import type { PluginRuntime } from "eve-agent/plugin-sdk/core";
import { createPluginRuntimeStore } from "eve-agent/plugin-sdk/runtime-store";

const {
  setRuntime: setSignalRuntime,
  getRuntime: getSignalRuntime,
  tryGetRuntime: getOptionalSignalRuntime,
  clearRuntime: clearSignalRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "signal",
  errorMessage: "Signal runtime not initialized",
});
export { clearSignalRuntime, getOptionalSignalRuntime, getSignalRuntime, setSignalRuntime };
