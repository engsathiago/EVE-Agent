// Gateway model-pricing config helper.
// Resolves whether cost/pricing metadata should be available to Gateway surfaces.
import type { EVEConfig } from "../config/types.eve.js";

/** Returns whether gateway model pricing/cost metadata should be shown. */
export function isGatewayModelPricingEnabled(config: EVEConfig): boolean {
  return config.models?.pricing?.enabled !== false;
}
