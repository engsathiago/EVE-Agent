/**
 * Active runtime config provider for the QQBot engine.
 *
 * Routing must re-evaluate `bindings[]` on every inbound message so that
 * peer/account binding edits made via the CLI take effect without
 * restarting the gateway. The provider hides the per-event lookup
 * behind a typed seam and falls back to the startup snapshot when the
 * runtime registry getter throws (e.g. snapshot not yet initialised).
 *
 * Issue #69546.
 */

import type { EVEConfig } from "eve-agent/plugin-sdk/core";
import { getRuntimeConfig } from "eve-agent/plugin-sdk/runtime-config-snapshot";

export type GatewayCfgLoader = () => EVEConfig;

export interface ActiveCfgProvider {
  getActiveCfg(): EVEConfig;
}

export interface ActiveCfgProviderOptions {
  fallback: EVEConfig;
  load?: GatewayCfgLoader;
}

export function createActiveCfgProvider(options: ActiveCfgProviderOptions): ActiveCfgProvider {
  const loader = options.load ?? defaultGatewayCfgLoader;
  const fallback = options.fallback;
  return {
    getActiveCfg(): EVEConfig {
      return resolveActiveCfg(loader, fallback);
    },
  };
}

export function resolveActiveCfg(loader: GatewayCfgLoader, fallback: EVEConfig): EVEConfig {
  try {
    return loader();
  } catch {
    return fallback;
  }
}

function defaultGatewayCfgLoader(): EVEConfig {
  return getRuntimeConfig();
}
