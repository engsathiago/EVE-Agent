// Discord type declarations define plugin contracts.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import type { ThreadBindingManager } from "./thread-bindings.js";

type DiscordConfig = NonNullable<EVEConfig["channels"]>["discord"];

export type DiscordCommandArgContext = {
  cfg: EVEConfig;
  discordConfig: DiscordConfig;
  accountId: string;
  sessionPrefix: string;
  threadBindings: ThreadBindingManager;
  postApplySettleMs?: number;
};

export type DiscordModelPickerContext = DiscordCommandArgContext;

export type SafeDiscordInteractionCall = <T>(
  label: string,
  fn: () => Promise<T>,
) => Promise<T | null>;
