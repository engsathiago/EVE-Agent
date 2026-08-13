// Verifies runtime plugin loading can reuse a compatible gateway startup registry.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry } from "../plugins/registry-empty.js";
import type { PluginRegistry } from "../plugins/registry-types.js";
import { resetPluginRuntimeStateForTest, setActivePluginRegistry } from "../plugins/runtime.js";

const mocks = vi.hoisted(() => ({
  getCurrentPluginMetadataSnapshot: vi.fn(),
  loadEVEPlugins: vi.fn<typeof import("../plugins/loader.js").loadEVEPlugins>(),
}));

vi.mock("../plugins/current-plugin-metadata-snapshot.js", () => ({
  getCurrentPluginMetadataSnapshot: mocks.getCurrentPluginMetadataSnapshot,
}));

vi.mock("../plugins/loader.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../plugins/loader.js")>();
  return {
    ...actual,
    loadEVEPlugins: (...args: Parameters<typeof mocks.loadEVEPlugins>) =>
      mocks.loadEVEPlugins(...args),
  };
});

const [{ ensureRuntimePluginsLoaded }, { clearPluginLoaderCache, testing }] = await Promise.all([
  import("./runtime-plugins.js"),
  import("../plugins/loader.js"),
]);

function createRegistryWithPlugin(pluginId: string): PluginRegistry {
  // Minimal active registry carrying just enough plugin identity for reuse checks.
  const registry = createEmptyPluginRegistry();
  registry.plugins.push({
    id: pluginId,
    status: "loaded",
  } as never);
  return registry;
}

beforeEach(() => {
  mocks.getCurrentPluginMetadataSnapshot.mockReset();
  mocks.loadEVEPlugins.mockReset();
});

afterEach(() => {
  clearPluginLoaderCache();
  resetPluginRuntimeStateForTest();
});

describe("ensureRuntimePluginsLoaded registry reuse", () => {
  it("reuses the compatible gateway startup registry on the dispatch caller path", () => {
    // Matching cache key plus gateway-bindable mode means no second plugin load.
    const config = { plugins: { allow: ["telegram"] } };
    const activeRegistry = createRegistryWithPlugin("telegram");
    activeRegistry.coreGatewayMethodNames = ["sessions.get", "sessions.list"];
    const startupLoadOptions = {
      config,
      activationSourceConfig: config,
      autoEnabledReasons: {},
      workspaceDir: "/tmp/workspace",
      onlyPluginIds: ["telegram"],
      coreGatewayMethodNames: ["sessions.get", "sessions.list"],
      runtimeOptions: {
        allowGatewaySubagentBinding: true,
      },
      preferBuiltPluginArtifacts: true,
    };
    const { cacheKey } = testing.resolvePluginLoadCacheContext(startupLoadOptions);
    setActivePluginRegistry(activeRegistry, cacheKey, "gateway-bindable", "/tmp/workspace");
    mocks.getCurrentPluginMetadataSnapshot.mockReturnValue({
      startup: {
        pluginIds: ["telegram"],
      },
    });
    mocks.loadEVEPlugins.mockImplementation(() => {
      throw new Error("dispatch should reuse the active gateway startup registry");
    });

    ensureRuntimePluginsLoaded({
      config,
      workspaceDir: "/tmp/workspace",
    });

    expect(mocks.getCurrentPluginMetadataSnapshot).toHaveBeenCalledWith({
      config,
      workspaceDir: "/tmp/workspace",
    });
    expect(mocks.loadEVEPlugins).not.toHaveBeenCalled();
  });
});
