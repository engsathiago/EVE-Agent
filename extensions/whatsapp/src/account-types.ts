// Whatsapp plugin module implements account types behavior.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<EVEConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
