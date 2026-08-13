/**
 * Resolves whether Codex app-server profiling instrumentation is enabled by
 * EVE diagnostic flags.
 */
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import { isDiagnosticFlagEnabled } from "eve-agent/plugin-sdk/diagnostic-runtime";

const PROFILER_FLAGS = ["profiler", "codex.profiler"] as const;

/** Checks the generic and Codex-specific profiler diagnostic flags. */
export function isCodexAppServerProfilerEnabled(
  config?: EVEConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return PROFILER_FLAGS.some((flag) => isDiagnosticFlagEnabled(flag, config, env));
}
