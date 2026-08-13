// Defines plugin install security scan result types.
import type { EVEConfig } from "../config/types.eve.js";

/** Overrides that intentionally loosen install safety policy for trusted/operator paths. */
export type InstallSafetyOverrides = {
  config?: EVEConfig;
  dangerouslyForceUnsafeInstall?: boolean;
  trustedSourceLinkedOfficialInstall?: boolean;
};
