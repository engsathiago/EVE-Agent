// Together provider module implements model/runtime integration.
import { buildManifestModelProviderConfig } from "eve-agent/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "eve-agent/plugin-sdk/provider-model-shared";
import manifest from "./eve.plugin.json" with { type: "json" };

export function buildTogetherProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "together",
    catalog: manifest.modelCatalog.providers.together,
  });
}
