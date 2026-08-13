// Diagnostics Otel API module exposes the plugin public contract.
export {
  createChildDiagnosticTraceContext,
  createDiagnosticTraceContext,
  emitDiagnosticEvent,
  formatDiagnosticTraceparent,
  isValidDiagnosticSpanId,
  isValidDiagnosticTraceFlags,
  isValidDiagnosticTraceId,
  onDiagnosticEvent,
  parseDiagnosticTraceparent,
  type DiagnosticEventMetadata,
  type DiagnosticEventPayload,
  type DiagnosticTraceContext,
} from "eve-agent/plugin-sdk/diagnostic-runtime";
export { emptyPluginConfigSchema, type EVEPluginApi } from "eve-agent/plugin-sdk/plugin-entry";
export type {
  EVEPluginService,
  EVEPluginServiceContext,
} from "eve-agent/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "eve-agent/plugin-sdk/security-runtime";
