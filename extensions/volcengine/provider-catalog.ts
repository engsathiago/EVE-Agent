// Volcengine provider module implements model/runtime integration.
import { buildManifestModelProviderConfig } from "eve-agent/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "eve-agent/plugin-sdk/provider-model-shared";
import manifest from "./eve.plugin.json" with { type: "json" };

export function buildDoubaoProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "volcengine",
    catalog: manifest.modelCatalog.providers.volcengine,
  });
}

export function buildDoubaoCodingProvider(): ModelProviderConfig {
  return buildManifestModelProviderConfig({
    providerId: "volcengine-plan",
    catalog: manifest.modelCatalog.providers["volcengine-plan"],
  });
}
