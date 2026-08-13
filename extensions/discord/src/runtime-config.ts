// Discord helper module supports runtime config behavior.
import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
  selectApplicableRuntimeConfig,
} from "eve-agent/plugin-sdk/runtime-config-snapshot";
import type { EVEConfig } from "./runtime-api.js";

export function selectDiscordRuntimeConfig(inputConfig: EVEConfig): EVEConfig {
  return (
    selectApplicableRuntimeConfig({
      inputConfig,
      runtimeConfig: getRuntimeConfigSnapshot(),
      runtimeSourceConfig: getRuntimeConfigSourceSnapshot(),
    }) ?? inputConfig
  );
}
