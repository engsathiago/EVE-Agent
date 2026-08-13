// Qwen setup module handles plugin onboarding behavior.
import {
  createModelCatalogPresetAppliers,
  type EVEConfig,
} from "eve-agent/plugin-sdk/provider-onboard";
import {
  QWEN_CN_BASE_URL,
  QWEN_DEFAULT_MODEL_REF,
  QWEN_GLOBAL_BASE_URL,
  QWEN_OAUTH_DEFAULT_MODEL_REF,
  QWEN_OAUTH_PROVIDER_ID,
  QWEN_STANDARD_CN_BASE_URL,
  QWEN_STANDARD_GLOBAL_BASE_URL,
} from "./models.js";
import { buildQwenOAuthProvider, buildQwenProvider } from "./provider-catalog.js";

const qwenPresetAppliers = createModelCatalogPresetAppliers<[string]>({
  primaryModelRef: QWEN_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: EVEConfig, baseUrl: string) => {
    const provider = buildQwenProvider({ baseUrl });
    return {
      providerId: "qwen",
      api: provider.api ?? "openai-completions",
      baseUrl,
      catalogModels: provider.models ?? [],
      aliases: [
        ...(provider.models ?? []).flatMap((model) => [
          `qwen/${model.id}`,
          `modelstudio/${model.id}`,
        ]),
        { modelRef: QWEN_DEFAULT_MODEL_REF, alias: "Qwen" },
      ],
    };
  },
});

const qwenOAuthPresetAppliers = createModelCatalogPresetAppliers<[]>({
  primaryModelRef: QWEN_OAUTH_DEFAULT_MODEL_REF,
  resolveParams: () => {
    const provider = buildQwenOAuthProvider();
    return {
      providerId: QWEN_OAUTH_PROVIDER_ID,
      api: provider.api ?? "openai-completions",
      baseUrl: provider.baseUrl,
      catalogModels: provider.models ?? [],
      aliases: [
        ...(provider.models ?? []).map((model) => `qwen-oauth/${model.id}`),
        { modelRef: QWEN_OAUTH_DEFAULT_MODEL_REF, alias: "Qwen OAuth" },
      ],
    };
  },
});

export function applyQwenConfig(cfg: EVEConfig): EVEConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_GLOBAL_BASE_URL);
}

export function applyQwenConfigCn(cfg: EVEConfig): EVEConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_CN_BASE_URL);
}

export function applyQwenStandardConfig(cfg: EVEConfig): EVEConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_STANDARD_GLOBAL_BASE_URL);
}

export function applyQwenStandardConfigCn(cfg: EVEConfig): EVEConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_STANDARD_CN_BASE_URL);
}

export function applyQwenOAuthConfig(cfg: EVEConfig): EVEConfig {
  return qwenOAuthPresetAppliers.applyConfig(cfg);
}
