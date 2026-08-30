import type { EVEConfig } from "../config/types.eve.js";

export const POST_CORE_UPDATE_SOURCE_CONFIG_PATH_ENV = "EVE_UPDATE_POST_CORE_SOURCE_CONFIG_PATH";

export type PreUpdateConfigRestoreInput = {
  sourceConfig: EVEConfig;
  authoredConfig: EVEConfig;
};
