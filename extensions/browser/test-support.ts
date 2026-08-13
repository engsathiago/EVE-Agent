/**
 * Browser test-support re-exports from shared plugin-sdk test fixtures.
 */
export {
  createCliRuntimeCapture,
  expectGeneratedTokenPersistedToGatewayAuth,
  type CliMockOutputRuntime,
  type CliRuntimeCapture,
} from "eve-agent/plugin-sdk/test-fixtures";
export {
  createTempHomeEnv,
  withEnv,
  withEnvAsync,
  withFetchPreconnect,
  isLiveTestEnabled,
} from "eve-agent/plugin-sdk/test-env";
export type { FetchMock, TempHomeEnv } from "eve-agent/plugin-sdk/test-env";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
