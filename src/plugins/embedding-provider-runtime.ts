/** Runtime resolver for plugin-contributed embedding providers. */
import type { EVEConfig } from "../config/types.eve.js";
import { resolveConfiguredGenericEmbeddingProviderId } from "./embedding-provider-config.js";
import {
  getRuntimeEmbeddingProviderAdapter,
  listRuntimeEmbeddingProviderAdapters,
  resolveRuntimeEmbeddingProviderLookupIds,
} from "./embedding-provider-runtime-shared.js";
import {
  getRegisteredEmbeddingProvider,
  listRegisteredEmbeddingProviders,
  type EmbeddingProviderAdapter,
} from "./embedding-providers.js";

export { listRegisteredEmbeddingProviders };

/** Lists embedding provider adapters registered directly with the process registry. */
export function listRegisteredEmbeddingProviderAdapters(): EmbeddingProviderAdapter[] {
  return listRegisteredEmbeddingProviders().map((entry) => entry.adapter);
}

/** Lists embedding providers from registered adapters and plugin capabilities. */
export function listEmbeddingProviders(cfg?: EVEConfig): EmbeddingProviderAdapter[] {
  return listRuntimeEmbeddingProviderAdapters({
    key: "embeddingProviders",
    cfg,
    registered: listRegisteredEmbeddingProviderAdapters(),
  });
}

export function resolveConfiguredEmbeddingProviderId(
  providerId: string,
  cfg?: EVEConfig,
): string | undefined {
  return resolveConfiguredGenericEmbeddingProviderId(providerId, cfg);
}

function resolveEmbeddingProviderLookupIds(id: string, cfg?: EVEConfig): string[] {
  return resolveRuntimeEmbeddingProviderLookupIds({
    id,
    cfg,
    resolveConfiguredProviderId: resolveConfiguredEmbeddingProviderId,
  });
}

/** Resolves one embedding provider adapter by id, including configured API aliases. */
export function getEmbeddingProvider(
  id: string,
  cfg?: EVEConfig,
): EmbeddingProviderAdapter | undefined {
  return getRuntimeEmbeddingProviderAdapter({
    key: "embeddingProviders",
    cfg,
    lookupIds: resolveEmbeddingProviderLookupIds(id, cfg),
    getRegisteredProvider: getRegisteredEmbeddingProvider,
  });
}

export type {
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingProviderAdapter,
  EmbeddingProviderCallOptions,
  EmbeddingProviderCreateOptions,
  EmbeddingProviderCreateResult,
  EmbeddingProviderRuntime,
  RegisteredEmbeddingProvider,
} from "./embedding-providers.js";
