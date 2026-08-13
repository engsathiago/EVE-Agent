// Diagnostics Prometheus API module exposes the plugin public contract.
export type {
  DiagnosticEventMetadata,
  DiagnosticEventPayload,
} from "eve-agent/plugin-sdk/diagnostic-runtime";
export { isInternalDiagnosticEventMetadata } from "eve-agent/plugin-sdk/diagnostic-runtime";
export {
  emptyPluginConfigSchema,
  type EVEPluginApi,
  type EVEPluginHttpRouteHandler,
  type EVEPluginService,
  type EVEPluginServiceContext,
} from "eve-agent/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "eve-agent/plugin-sdk/security-runtime";
