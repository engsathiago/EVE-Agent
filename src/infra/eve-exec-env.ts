/** Process env key that marks child commands as launched by the EVE CLI. */
export const EVE_CLI_ENV_VAR = "EVE_CLI";

/** Stable marker value used for EVE-launched subprocess detection. */
export const EVE_CLI_ENV_VALUE = "1";

/** Returns a cloned env object with the EVE CLI marker set. */
export function markEVEExecEnv<T extends Record<string, string | undefined>>(
  /** Source environment to clone before adding the subprocess marker. */
  env: T,
): T {
  return {
    ...env,
    [EVE_CLI_ENV_VAR]: EVE_CLI_ENV_VALUE,
  };
}

/** Mutates an existing process env object so current-process children inherit the marker. */
export function ensureEVEExecMarkerOnProcess(
  /** Process env object to mutate; defaults to the current process environment. */
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[EVE_CLI_ENV_VAR] = EVE_CLI_ENV_VALUE;
  return env;
}
