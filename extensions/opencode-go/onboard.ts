// Opencode Go setup module handles plugin onboarding behavior.
import {
  applyAgentDefaultModelPrimary,
  type EVEConfig,
} from "eve-agent/plugin-sdk/provider-onboard";

export const OPENCODE_GO_DEFAULT_MODEL_REF = "opencode-go/kimi-k2.6";

export function applyOpencodeGoProviderConfig(cfg: EVEConfig): EVEConfig {
  return cfg;
}

export function applyOpencodeGoConfig(cfg: EVEConfig): EVEConfig {
  return applyAgentDefaultModelPrimary(
    applyOpencodeGoProviderConfig(cfg),
    OPENCODE_GO_DEFAULT_MODEL_REF,
  );
}
