// Provider-index types describe install hints, auth choices, and preview catalogs for discoverable providers.
import type { ModelCatalogProvider } from "@eve/model-catalog-core/model-catalog-types";

// Normalized provider-index schema. It describes providers discoverable before
// plugin install, including install hints, auth choices, and preview catalogs.
export type EVEProviderIndexPluginInstall = {
  clawhubSpec?: string;
  npmSpec?: string;
  defaultChoice?: "clawhub" | "npm";
  minHostVersion?: string;
  expectedIntegrity?: string;
};

export type EVEProviderIndexPlugin = {
  id: string;
  package?: string;
  source?: string;
  install?: EVEProviderIndexPluginInstall;
};

export type EVEProviderIndexProviderAuthChoice = {
  method: string;
  choiceId: string;
  choiceLabel: string;
  choiceHint?: string;
  assistantPriority?: number;
  assistantVisibility?: "visible" | "manual-only";
  groupId?: string;
  groupLabel?: string;
  groupHint?: string;
  optionKey?: string;
  cliFlag?: string;
  cliOption?: string;
  cliDescription?: string;
  onboardingScopes?: readonly ("text-inference" | "image-generation" | "music-generation")[];
};

export type EVEProviderIndexProvider = {
  id: string;
  name: string;
  plugin: EVEProviderIndexPlugin;
  docs?: string;
  categories?: readonly string[];
  authChoices?: readonly EVEProviderIndexProviderAuthChoice[];
  previewCatalog?: ModelCatalogProvider;
};

export type EVEProviderIndex = {
  version: number;
  providers: Readonly<Record<string, EVEProviderIndexProvider>>;
};
