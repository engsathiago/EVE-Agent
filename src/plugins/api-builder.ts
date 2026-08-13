// Builds plugin API objects from config, registries, and runtime helpers.
import type { EVEConfig } from "../config/types.eve.js";
import { attachPluginApiFacades, type EVEPluginApiWithoutFacades } from "./api-facades.js";
import type { PluginRuntime } from "./runtime/types.js";
import type { EVEPluginApi, PluginLogger } from "./types.js";

export type BuildPluginApiParams = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir?: string;
  registrationMode: EVEPluginApi["registrationMode"];
  config: EVEConfig;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  resolvePath: (input: string) => string;
  handlers?: Partial<
    Pick<
      EVEPluginApi,
      | "registerTool"
      | "registerHook"
      | "registerHttpRoute"
      | "registerHostedMediaResolver"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerCli"
      | "registerReload"
      | "registerNodeHostCommand"
      | "registerNodeInvokePolicy"
      | "registerSecurityAuditCollector"
      | "registerService"
      | "registerGatewayDiscoveryService"
      | "registerCliBackend"
      | "registerTextTransforms"
      | "registerConfigMigration"
      | "registerMigrationProvider"
      | "registerAutoEnableProbe"
      | "registerProvider"
      | "registerModelCatalogProvider"
      | "registerEmbeddingProvider"
      | "registerSpeechProvider"
      | "registerRealtimeTranscriptionProvider"
      | "registerRealtimeVoiceProvider"
      | "registerMediaUnderstandingProvider"
      | "registerTranscriptSourceProvider"
      | "registerImageGenerationProvider"
      | "registerVideoGenerationProvider"
      | "registerMusicGenerationProvider"
      | "registerWebFetchProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerCompactionProvider"
      | "registerAgentHarness"
      | "registerCodexAppServerExtensionFactory"
      | "registerAgentToolResultMiddleware"
      | "registerSessionExtension"
      | "enqueueNextTurnInjection"
      | "registerTrustedToolPolicy"
      | "registerToolMetadata"
      | "registerControlUiDescriptor"
      | "registerRuntimeLifecycle"
      | "registerAgentEventSubscription"
      | "emitAgentEvent"
      | "setRunContext"
      | "getRunContext"
      | "clearRunContext"
      | "registerSessionSchedulerJob"
      | "registerSessionAction"
      | "sendSessionAttachment"
      | "scheduleSessionTurn"
      | "unscheduleSessionTurnsByTag"
      | "registerDetachedTaskRuntime"
      | "registerMemoryCapability"
      | "registerMemoryPromptSection"
      | "registerMemoryPromptSupplement"
      | "registerMemoryCorpusSupplement"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "on"
    >
  >;
};

const noopRegisterTool: EVEPluginApi["registerTool"] = () => {};
const noopRegisterHook: EVEPluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: EVEPluginApi["registerHttpRoute"] = () => {};
const noopRegisterHostedMediaResolver: EVEPluginApi["registerHostedMediaResolver"] = () => {};
const noopRegisterChannel: EVEPluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: EVEPluginApi["registerGatewayMethod"] = () => {};
const noopRegisterCli: EVEPluginApi["registerCli"] = () => {};
const noopRegisterReload: EVEPluginApi["registerReload"] = () => {};
const noopRegisterNodeHostCommand: EVEPluginApi["registerNodeHostCommand"] = () => {};
const noopRegisterNodeInvokePolicy: EVEPluginApi["registerNodeInvokePolicy"] = () => {};
const noopRegisterSecurityAuditCollector: EVEPluginApi["registerSecurityAuditCollector"] =
  () => {};
const noopRegisterService: EVEPluginApi["registerService"] = () => {};
const noopRegisterGatewayDiscoveryService: EVEPluginApi["registerGatewayDiscoveryService"] =
  () => {};
const noopRegisterCliBackend: EVEPluginApi["registerCliBackend"] = () => {};
const noopRegisterTextTransforms: EVEPluginApi["registerTextTransforms"] = () => {};
const noopRegisterConfigMigration: EVEPluginApi["registerConfigMigration"] = () => {};
const noopRegisterMigrationProvider: EVEPluginApi["registerMigrationProvider"] = () => {};
const noopRegisterAutoEnableProbe: EVEPluginApi["registerAutoEnableProbe"] = () => {};
const noopRegisterProvider: EVEPluginApi["registerProvider"] = () => {};
const noopRegisterModelCatalogProvider: EVEPluginApi["registerModelCatalogProvider"] =
  () => {};
const noopRegisterEmbeddingProvider: EVEPluginApi["registerEmbeddingProvider"] = () => {};
const noopRegisterSpeechProvider: EVEPluginApi["registerSpeechProvider"] = () => {};
const noopRegisterRealtimeTranscriptionProvider: EVEPluginApi["registerRealtimeTranscriptionProvider"] =
  () => {};
const noopRegisterRealtimeVoiceProvider: EVEPluginApi["registerRealtimeVoiceProvider"] =
  () => {};
const noopRegisterMediaUnderstandingProvider: EVEPluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterTranscriptsSourceProvider: EVEPluginApi["registerTranscriptSourceProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: EVEPluginApi["registerImageGenerationProvider"] =
  () => {};
const noopRegisterVideoGenerationProvider: EVEPluginApi["registerVideoGenerationProvider"] =
  () => {};
const noopRegisterMusicGenerationProvider: EVEPluginApi["registerMusicGenerationProvider"] =
  () => {};
const noopRegisterWebFetchProvider: EVEPluginApi["registerWebFetchProvider"] = () => {};
const noopRegisterWebSearchProvider: EVEPluginApi["registerWebSearchProvider"] = () => {};
const noopRegisterInteractiveHandler: EVEPluginApi["registerInteractiveHandler"] = () => {};
const noopOnConversationBindingResolved: EVEPluginApi["onConversationBindingResolved"] =
  () => {};
const noopRegisterCommand: EVEPluginApi["registerCommand"] = () => {};
const noopRegisterContextEngine: EVEPluginApi["registerContextEngine"] = () => {};
const noopRegisterCompactionProvider: EVEPluginApi["registerCompactionProvider"] = () => {};
const noopRegisterAgentHarness: EVEPluginApi["registerAgentHarness"] = () => {};
const noopRegisterCodexAppServerExtensionFactory: EVEPluginApi["registerCodexAppServerExtensionFactory"] =
  () => {};
const noopRegisterAgentToolResultMiddleware: EVEPluginApi["registerAgentToolResultMiddleware"] =
  () => {};
const noopRegisterSessionExtension: EVEPluginApi["registerSessionExtension"] = () => {};
const noopEnqueueNextTurnInjection: EVEPluginApi["enqueueNextTurnInjection"] = async (
  injection,
) => ({ enqueued: false, id: "", sessionKey: injection.sessionKey });
const noopRegisterTrustedToolPolicy: EVEPluginApi["registerTrustedToolPolicy"] = () => {};
const noopRegisterToolMetadata: EVEPluginApi["registerToolMetadata"] = () => {};
const noopRegisterControlUiDescriptor: EVEPluginApi["registerControlUiDescriptor"] = () => {};
const noopRegisterRuntimeLifecycle: EVEPluginApi["registerRuntimeLifecycle"] = () => {};
const noopRegisterAgentEventSubscription: EVEPluginApi["registerAgentEventSubscription"] =
  () => {};
const noopEmitAgentEvent: EVEPluginApi["emitAgentEvent"] = () => ({
  emitted: false,
  reason: "not wired",
});
const noopSetRunContext: EVEPluginApi["setRunContext"] = () => false;
const noopGetRunContext: EVEPluginApi["getRunContext"] = () => undefined;
const noopClearRunContext: EVEPluginApi["clearRunContext"] = () => {};
const noopRegisterSessionSchedulerJob: EVEPluginApi["registerSessionSchedulerJob"] = () =>
  undefined;
const noopRegisterSessionAction: EVEPluginApi["registerSessionAction"] = () => {};
const noopSendSessionAttachment: EVEPluginApi["sendSessionAttachment"] = async () => ({
  ok: false,
  error: "not wired",
});
const noopScheduleSessionTurn: EVEPluginApi["scheduleSessionTurn"] = async () => undefined;
const noopUnscheduleSessionTurnsByTag: EVEPluginApi["unscheduleSessionTurnsByTag"] =
  async () => ({ removed: 0, failed: 0 });
const noopRegisterDetachedTaskRuntime: EVEPluginApi["registerDetachedTaskRuntime"] = () => {};
const noopRegisterMemoryCapability: EVEPluginApi["registerMemoryCapability"] = () => {};
const noopRegisterMemoryPromptSection: EVEPluginApi["registerMemoryPromptSection"] = () => {};
const noopRegisterMemoryPromptSupplement: EVEPluginApi["registerMemoryPromptSupplement"] =
  () => {};
const noopRegisterMemoryCorpusSupplement: EVEPluginApi["registerMemoryCorpusSupplement"] =
  () => {};
const noopRegisterMemoryFlushPlan: EVEPluginApi["registerMemoryFlushPlan"] = () => {};
const noopRegisterMemoryRuntime: EVEPluginApi["registerMemoryRuntime"] = () => {};
const noopRegisterMemoryEmbeddingProvider: EVEPluginApi["registerMemoryEmbeddingProvider"] =
  () => {};
const noopOn: EVEPluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): EVEPluginApi {
  const handlers = params.handlers ?? {};
  const registerCli = handlers.registerCli ?? noopRegisterCli;
  const api: EVEPluginApiWithoutFacades = {
    id: params.id,
    name: params.name,
    version: params.version,
    description: params.description,
    source: params.source,
    rootDir: params.rootDir,
    registrationMode: params.registrationMode,
    config: params.config,
    pluginConfig: params.pluginConfig,
    runtime: params.runtime,
    logger: params.logger,
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerHostedMediaResolver:
      handlers.registerHostedMediaResolver ?? noopRegisterHostedMediaResolver,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerCli,
    registerNodeCliFeature: (registrar, opts) =>
      registerCli(registrar, {
        ...opts,
        parentPath: ["nodes"],
      }),
    registerReload: handlers.registerReload ?? noopRegisterReload,
    registerNodeHostCommand: handlers.registerNodeHostCommand ?? noopRegisterNodeHostCommand,
    registerNodeInvokePolicy: handlers.registerNodeInvokePolicy ?? noopRegisterNodeInvokePolicy,
    registerSecurityAuditCollector:
      handlers.registerSecurityAuditCollector ?? noopRegisterSecurityAuditCollector,
    registerService: handlers.registerService ?? noopRegisterService,
    registerGatewayDiscoveryService:
      handlers.registerGatewayDiscoveryService ?? noopRegisterGatewayDiscoveryService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerTextTransforms: handlers.registerTextTransforms ?? noopRegisterTextTransforms,
    registerConfigMigration: handlers.registerConfigMigration ?? noopRegisterConfigMigration,
    registerMigrationProvider: handlers.registerMigrationProvider ?? noopRegisterMigrationProvider,
    registerAutoEnableProbe: handlers.registerAutoEnableProbe ?? noopRegisterAutoEnableProbe,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerModelCatalogProvider:
      handlers.registerModelCatalogProvider ?? noopRegisterModelCatalogProvider,
    registerEmbeddingProvider: handlers.registerEmbeddingProvider ?? noopRegisterEmbeddingProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerRealtimeTranscriptionProvider:
      handlers.registerRealtimeTranscriptionProvider ?? noopRegisterRealtimeTranscriptionProvider,
    registerRealtimeVoiceProvider:
      handlers.registerRealtimeVoiceProvider ?? noopRegisterRealtimeVoiceProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerTranscriptSourceProvider:
      handlers.registerTranscriptSourceProvider ?? noopRegisterTranscriptsSourceProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
    registerVideoGenerationProvider:
      handlers.registerVideoGenerationProvider ?? noopRegisterVideoGenerationProvider,
    registerMusicGenerationProvider:
      handlers.registerMusicGenerationProvider ?? noopRegisterMusicGenerationProvider,
    registerWebFetchProvider: handlers.registerWebFetchProvider ?? noopRegisterWebFetchProvider,
    registerWebSearchProvider: handlers.registerWebSearchProvider ?? noopRegisterWebSearchProvider,
    registerInteractiveHandler:
      handlers.registerInteractiveHandler ?? noopRegisterInteractiveHandler,
    onConversationBindingResolved:
      handlers.onConversationBindingResolved ?? noopOnConversationBindingResolved,
    registerCommand: handlers.registerCommand ?? noopRegisterCommand,
    registerContextEngine: handlers.registerContextEngine ?? noopRegisterContextEngine,
    registerCompactionProvider:
      handlers.registerCompactionProvider ?? noopRegisterCompactionProvider,
    registerAgentHarness: handlers.registerAgentHarness ?? noopRegisterAgentHarness,
    registerCodexAppServerExtensionFactory:
      handlers.registerCodexAppServerExtensionFactory ?? noopRegisterCodexAppServerExtensionFactory,
    registerAgentToolResultMiddleware:
      handlers.registerAgentToolResultMiddleware ?? noopRegisterAgentToolResultMiddleware,
    registerSessionExtension: handlers.registerSessionExtension ?? noopRegisterSessionExtension,
    enqueueNextTurnInjection: handlers.enqueueNextTurnInjection ?? noopEnqueueNextTurnInjection,
    registerTrustedToolPolicy: handlers.registerTrustedToolPolicy ?? noopRegisterTrustedToolPolicy,
    registerToolMetadata: handlers.registerToolMetadata ?? noopRegisterToolMetadata,
    registerControlUiDescriptor:
      handlers.registerControlUiDescriptor ?? noopRegisterControlUiDescriptor,
    registerRuntimeLifecycle: handlers.registerRuntimeLifecycle ?? noopRegisterRuntimeLifecycle,
    registerAgentEventSubscription:
      handlers.registerAgentEventSubscription ?? noopRegisterAgentEventSubscription,
    emitAgentEvent: handlers.emitAgentEvent ?? noopEmitAgentEvent,
    setRunContext: handlers.setRunContext ?? noopSetRunContext,
    getRunContext: handlers.getRunContext ?? noopGetRunContext,
    clearRunContext: handlers.clearRunContext ?? noopClearRunContext,
    registerSessionSchedulerJob:
      handlers.registerSessionSchedulerJob ?? noopRegisterSessionSchedulerJob,
    registerSessionAction: handlers.registerSessionAction ?? noopRegisterSessionAction,
    sendSessionAttachment: handlers.sendSessionAttachment ?? noopSendSessionAttachment,
    scheduleSessionTurn: handlers.scheduleSessionTurn ?? noopScheduleSessionTurn,
    unscheduleSessionTurnsByTag:
      handlers.unscheduleSessionTurnsByTag ?? noopUnscheduleSessionTurnsByTag,
    registerDetachedTaskRuntime:
      handlers.registerDetachedTaskRuntime ?? noopRegisterDetachedTaskRuntime,
    registerMemoryCapability: handlers.registerMemoryCapability ?? noopRegisterMemoryCapability,
    registerMemoryPromptSection:
      handlers.registerMemoryPromptSection ?? noopRegisterMemoryPromptSection,
    registerMemoryPromptSupplement:
      handlers.registerMemoryPromptSupplement ?? noopRegisterMemoryPromptSupplement,
    registerMemoryCorpusSupplement:
      handlers.registerMemoryCorpusSupplement ?? noopRegisterMemoryCorpusSupplement,
    registerMemoryFlushPlan: handlers.registerMemoryFlushPlan ?? noopRegisterMemoryFlushPlan,
    registerMemoryRuntime: handlers.registerMemoryRuntime ?? noopRegisterMemoryRuntime,
    registerMemoryEmbeddingProvider:
      handlers.registerMemoryEmbeddingProvider ?? noopRegisterMemoryEmbeddingProvider,
    resolvePath: params.resolvePath,
    on: handlers.on ?? noopOn,
  };
  return attachPluginApiFacades(api);
}
