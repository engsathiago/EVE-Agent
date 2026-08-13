// Check Plugin Sdk Wildcard Reexports tests cover check plugin sdk wildcard reexports script behavior.
import { describe, expect, it } from "vitest";
import { findPluginSdkWildcardReexports } from "../../scripts/check-plugin-sdk-wildcard-reexports.mjs";

describe("check-plugin-sdk-wildcard-reexports", () => {
  it("flags wildcard re-exports from plugin-sdk subpaths", () => {
    expect(
      findPluginSdkWildcardReexports(
        [
          'export * from "eve-agent/plugin-sdk/foo";',
          'export type * from "eve-agent/plugin-sdk/bar";',
          'export { named } from "eve-agent/plugin-sdk/foo";',
        ].join("\n"),
      ),
    ).toEqual([
      { line: 1, text: 'export * from "eve-agent/plugin-sdk/foo";' },
      { line: 2, text: 'export type * from "eve-agent/plugin-sdk/bar";' },
    ]);
  });

  it("allows explicit SDK exports and local wildcard barrels", () => {
    expect(
      findPluginSdkWildcardReexports(
        [
          'export { named } from "eve-agent/plugin-sdk/foo";',
          'export type { Named } from "eve-agent/plugin-sdk/foo";',
          'export * from "./src/runtime-api.js";',
        ].join("\n"),
      ),
    ).toStrictEqual([]);
  });
});
