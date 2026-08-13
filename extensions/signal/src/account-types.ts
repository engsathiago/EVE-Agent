// Signal plugin module implements account types behavior.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<EVEConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
