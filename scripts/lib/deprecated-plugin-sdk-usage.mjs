// Builds the list of deprecated public plugin SDK specifiers guarded by scripts.
import deprecatedPublicPluginSdkSubpaths from "./plugin-sdk-deprecated-public-subpaths.json" with { type: "json" };

const DEPRECATED_PLUGIN_SDK_EXTRA_SPECIFIERS = [
  "eve-agent/plugin-sdk",
  "eve-agent/plugin-sdk/agent-dir-compat",
  "eve-agent/plugin-sdk/test-utils",
];

/** Build fully qualified deprecated plugin SDK module specifiers from subpath metadata. */
export function buildDeprecatedPluginSdkModuleSpecifiers(
  deprecatedSubpaths = deprecatedPublicPluginSdkSubpaths,
) {
  return [
    ...new Set([
      ...DEPRECATED_PLUGIN_SDK_EXTRA_SPECIFIERS,
      ...deprecatedSubpaths.map((subpath) => `eve-agent/plugin-sdk/${subpath}`),
    ]),
  ].toSorted();
}
