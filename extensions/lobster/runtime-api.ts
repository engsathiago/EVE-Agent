// Lobster API module exposes the plugin public contract.
export { definePluginEntry } from "eve-agent/plugin-sdk/core";
export type {
  AnyAgentTool,
  EVEPluginApi,
  EVEPluginToolContext,
  EVEPluginToolFactory,
} from "eve-agent/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "eve-agent/plugin-sdk/windows-spawn";
