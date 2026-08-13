// Nostr plugin module implements runtime behavior.
import type { PluginRuntime } from "eve-agent/plugin-sdk/core";
import { createPluginRuntimeStore } from "eve-agent/plugin-sdk/runtime-store";

const { setRuntime: setNostrRuntime, getRuntime: getNostrRuntime } =
  createPluginRuntimeStore<PluginRuntime>({
    pluginId: "nostr",
    errorMessage: "Nostr runtime not initialized",
  });
export { getNostrRuntime, setNostrRuntime };
