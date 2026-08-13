// Covers plugin discovery threading and concurrency behavior.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PluginDiscoveryResult } from "./discovery.js";

const discoverEVEPluginsMock = vi.fn();

vi.mock("./discovery.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./discovery.js")>();
  return {
    ...actual,
    discoverEVEPlugins: (...args: unknown[]) => discoverEVEPluginsMock(...args),
  };
});

const { loadPluginManifestRegistry } = await import("./manifest-registry.js");
const { resolveInstalledPluginIndexRegistry } =
  await import("./installed-plugin-index-registry.js");

const emptyDiscovery: PluginDiscoveryResult = { candidates: [], diagnostics: [] };

describe("discovery threading", () => {
  beforeEach(() => {
    discoverEVEPluginsMock.mockReset();
    discoverEVEPluginsMock.mockReturnValue(emptyDiscovery);
  });

  it("skips internal discoverEVEPlugins when discovery is supplied", () => {
    loadPluginManifestRegistry({ discovery: emptyDiscovery });
    expect(discoverEVEPluginsMock).not.toHaveBeenCalled();

    discoverEVEPluginsMock.mockClear();
    resolveInstalledPluginIndexRegistry({ discovery: emptyDiscovery, installRecords: {} });
    expect(discoverEVEPluginsMock).not.toHaveBeenCalled();
  });

  it("calls discoverEVEPlugins when neither discovery nor candidates supplied", () => {
    loadPluginManifestRegistry({});
    expect(discoverEVEPluginsMock).toHaveBeenCalledTimes(1);

    discoverEVEPluginsMock.mockClear();
    resolveInstalledPluginIndexRegistry({ installRecords: {} });
    expect(discoverEVEPluginsMock).toHaveBeenCalledTimes(1);
  });

  it("prefers explicit candidates over discovery when both are supplied", () => {
    loadPluginManifestRegistry({ candidates: [], diagnostics: [], discovery: emptyDiscovery });
    expect(discoverEVEPluginsMock).not.toHaveBeenCalled();

    discoverEVEPluginsMock.mockClear();
    resolveInstalledPluginIndexRegistry({
      candidates: [],
      discovery: emptyDiscovery,
      installRecords: {},
    });
    expect(discoverEVEPluginsMock).not.toHaveBeenCalled();
  });
});
