// Telegram API module exposes the plugin public contract.
import type { EVEConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: EVEConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
