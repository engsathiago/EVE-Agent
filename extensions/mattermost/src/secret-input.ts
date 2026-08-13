// Mattermost plugin module implements secret input behavior.
export type { SecretInput } from "eve-agent/plugin-sdk/secret-input";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "eve-agent/plugin-sdk/secret-input";
