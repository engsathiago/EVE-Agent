// Zalouser plugin module implements runtime behavior.
import type { PluginRuntime } from "eve-agent/plugin-sdk/core";
import { createPluginRuntimeStore } from "eve-agent/plugin-sdk/runtime-store";

const { setRuntime: setZalouserRuntime, getRuntime: getZalouserRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "zalouser",
    errorMessage: "Zalouser runtime not initialized",
  });
export { getZalouserRuntime, setZalouserRuntime };
