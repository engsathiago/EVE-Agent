// Guards config writes that are disallowed in Nix-managed installs.
import { resolveIsNixMode } from "./paths.js";

/** Agent-first Nix install docs shown when runtime config writes are blocked. */
export const NIX_EVE_AGENT_FIRST_URL = "https://github.com/eve/nix-eve#quick-start";
/** Public EVE Nix overview shown with immutable-config errors. */
export const EVE_NIX_OVERVIEW_URL = "https://docs.eve.ai/install/nix";

/** Error thrown when a mutating config path is attempted while Nix owns config state. */
export class NixModeConfigMutationError extends Error {
  readonly code = "EVE_NIX_MODE_CONFIG_IMMUTABLE";

  constructor(params: { configPath?: string } = {}) {
    super(formatNixModeConfigMutationMessage(params));
    this.name = "NixModeConfigMutationError";
  }
}

/** Build the operator-facing immutable-config message for Nix-managed installs. */
export function formatNixModeConfigMutationMessage(params: { configPath?: string } = {}): string {
  return [
    "Config is managed by Nix (`EVE_NIX_MODE=1`), so EVE treats eve.json as immutable.",
    "This usually means nix-eve, the first-party Nix distribution, or another Nix-managed package set this mode.",
    ...(params.configPath ? [`Config path: ${params.configPath}`] : []),
    "Do not run setup, onboarding, eve update, plugin install/update/uninstall/enable, doctor repair/token-generation, or config set against this file.",
    "Edit the Nix source for this install instead. For nix-eve, edit `programs.eve.config` or `instances.<name>.config`, then rebuild with Home Manager or NixOS.",
    `Agent-first Nix setup: ${NIX_EVE_AGENT_FIRST_URL}`,
    `EVE Nix overview: ${EVE_NIX_OVERVIEW_URL}`,
  ].join("\n");
}

/** Throw when the current environment marks EVE config as Nix-managed and immutable. */
export function assertConfigWriteAllowedInCurrentMode(
  params: {
    configPath?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): void {
  if (!resolveIsNixMode(params.env)) {
    return;
  }
  // In Nix mode, all writes must happen in the declarative source and then rebuild.
  throw new NixModeConfigMutationError({ configPath: params.configPath });
}
