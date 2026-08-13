import type { EVEConfig, TelegramAccountConfig } from "eve-agent/plugin-sdk/config-contracts";
import { mergeTelegramAccountConfig } from "./account-config.js";

export type TelegramGroupHistoryContextMode = NonNullable<
  TelegramAccountConfig["includeGroupHistoryContext"]
>;

export const DEFAULT_TELEGRAM_GROUP_HISTORY_CONTEXT_MODE: TelegramGroupHistoryContextMode =
  "mention-only";

export function resolveTelegramGroupHistoryContextMode(
  config?: Pick<TelegramAccountConfig, "includeGroupHistoryContext">,
): TelegramGroupHistoryContextMode {
  return config?.includeGroupHistoryContext ?? DEFAULT_TELEGRAM_GROUP_HISTORY_CONTEXT_MODE;
}

export function resolveTelegramGroupHistoryContextModeForAccount(params: {
  cfg: EVEConfig;
  accountId: string;
}): TelegramGroupHistoryContextMode {
  return resolveTelegramGroupHistoryContextMode(
    mergeTelegramAccountConfig(params.cfg, params.accountId),
  );
}

export function includesRecentTelegramGroupHistoryContext(
  mode: TelegramGroupHistoryContextMode,
): boolean {
  return mode === "recent";
}
