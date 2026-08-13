// Image Generation Core API module exposes the plugin public contract.
export type { AuthProfileStore } from "eve-agent/plugin-sdk/image-generation-core";
export {
  buildNoCapabilityModelConfiguredMessage,
  createSubsystemLogger,
  describeFailoverError,
  getImageGenerationProvider,
  getProviderEnvVars,
  isFailoverError,
  listImageGenerationProviders,
  normalizeGoogleModelId,
  OPENAI_DEFAULT_IMAGE_MODEL,
  parseImageGenerationModelRef,
  resolveAgentModelFallbackValues,
  resolveAgentModelPrimaryValue,
  resolveApiKeyForProvider,
  resolveCapabilityModelCandidates,
  throwCapabilityGenerationFailure,
} from "eve-agent/plugin-sdk/image-generation-core";
export type {
  FallbackAttempt,
  GeneratedImageAsset,
  ImageGenerationProvider,
  ImageGenerationProviderConfiguredContext,
  ImageGenerationProviderPlugin,
  ImageGenerationRequest,
  ImageGenerationResolution,
  ImageGenerationResult,
  ImageGenerationSourceImage,
  EVEConfig,
} from "eve-agent/plugin-sdk/image-generation-core";
