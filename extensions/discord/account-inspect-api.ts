// Discord API module exposes the plugin public contract.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: EVEConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
