// Slack API module exposes the plugin public contract.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: EVEConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
