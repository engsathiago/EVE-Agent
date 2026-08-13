// Verifies bundled capability runtime registration from plugin metadata.
import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["eve-agent/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@eve/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["eve-agent/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@eve/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["eve-agent/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@eve/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["eve-agent/plugin-sdk/speech-core"]).toBe(
      aliasMap["@eve/plugin-sdk/speech-core"],
    );
  });
});
