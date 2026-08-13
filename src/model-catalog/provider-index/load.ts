// Provider-index loader normalizes bundled installable-provider metadata and falls back to an empty index.
import { normalizeEVEProviderIndex } from "./normalize.js";
import { EVE_PROVIDER_INDEX } from "./eve-provider-index.js";
import type { EVEProviderIndex } from "./types.js";

// Load the bundled provider index through the normalizer. Invalid generated or
// caller-supplied data falls back to an empty v1 index instead of leaking shape.
export function loadEVEProviderIndex(
  source: unknown = EVE_PROVIDER_INDEX,
): EVEProviderIndex {
  return normalizeEVEProviderIndex(source) ?? { version: 1, providers: {} };
}
