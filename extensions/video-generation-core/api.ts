// Video Generation Core API module exposes the plugin public contract.
export type { AuthProfileStore } from "eve-agent/plugin-sdk/video-generation-core";
export {
  buildNoCapabilityModelConfiguredMessage,
  createSubsystemLogger,
  describeFailoverError,
  getProviderEnvVars,
  getVideoGenerationProvider,
  isFailoverError,
  listVideoGenerationProviders,
  parseVideoGenerationModelRef,
  resolveAgentModelFallbackValues,
  resolveAgentModelPrimaryValue,
  resolveCapabilityModelCandidates,
  throwCapabilityGenerationFailure,
} from "eve-agent/plugin-sdk/video-generation-core";
export type {
  FallbackAttempt,
  GeneratedVideoAsset,
  EVEConfig,
  VideoGenerationIgnoredOverride,
  VideoGenerationMode,
  VideoGenerationModeCapabilities,
  VideoGenerationProvider,
  VideoGenerationProviderCapabilities,
  VideoGenerationProviderConfiguredContext,
  VideoGenerationProviderPlugin,
  VideoGenerationRequest,
  VideoGenerationResolution,
  VideoGenerationResult,
  VideoGenerationSourceAsset,
  VideoGenerationTransformCapabilities,
} from "eve-agent/plugin-sdk/video-generation-core";
