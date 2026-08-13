// Imessage plugin module implements account types behavior.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<EVEConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
