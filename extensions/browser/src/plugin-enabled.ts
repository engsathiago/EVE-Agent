/**
 * Browser plugin enablement resolver for bundled-plugin defaults.
 */
import type { EVEConfig } from "./sdk-config.js";
import { normalizePluginsConfig, resolveEffectiveEnableState } from "./sdk-config.js";

/** Returns whether the bundled Browser plugin is effectively enabled by config. */
export function isDefaultBrowserPluginEnabled(cfg: EVEConfig): boolean {
  return resolveEffectiveEnableState({
    id: "browser",
    origin: "bundled",
    config: normalizePluginsConfig(cfg.plugins),
    rootConfig: cfg,
    enabledByDefault: true,
  }).enabled;
}
