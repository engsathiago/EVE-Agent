// Provider-index public facade for normalized provider discovery metadata.
export { loadEVEProviderIndex } from "./load.js";
export { normalizeEVEProviderIndex } from "./normalize.js";
export type {
  EVEProviderIndex,
  EVEProviderIndexPluginInstall,
  EVEProviderIndexPlugin,
  EVEProviderIndexProviderAuthChoice,
  EVEProviderIndexProvider,
} from "./types.js";
