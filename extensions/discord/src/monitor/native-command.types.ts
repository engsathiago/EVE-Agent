// Discord type declarations define plugin contracts.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import type { CommandArgValues } from "eve-agent/plugin-sdk/native-command-registry";

export type DiscordConfig = NonNullable<EVEConfig["channels"]>["discord"];

export type DiscordCommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};
