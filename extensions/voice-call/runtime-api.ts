// Private runtime barrel for the bundled Voice Call extension.
// Keep this barrel thin and aligned with the local extension surface.

export { definePluginEntry } from "eve-agent/plugin-sdk/plugin-entry";
export type { EVEPluginApi } from "eve-agent/plugin-sdk/plugin-entry";
export type { GatewayRequestHandlerOptions } from "eve-agent/plugin-sdk/gateway-runtime";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "eve-agent/plugin-sdk/webhook-request-guards";
export { fetchWithSsrFGuard, isBlockedHostnameOrIp } from "eve-agent/plugin-sdk/ssrf-runtime";
export type { SessionEntry } from "eve-agent/plugin-sdk/session-store-runtime";
export {
  TtsAutoSchema,
  TtsConfigSchema,
  TtsModeSchema,
  TtsProviderSchema,
} from "eve-agent/plugin-sdk/tts-runtime";
export { sleep } from "eve-agent/plugin-sdk/runtime-env";
