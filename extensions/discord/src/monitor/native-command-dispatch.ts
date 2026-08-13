// Discord plugin module implements native command dispatch behavior.
import type { ChatCommandDefinition, CommandArgs } from "eve-agent/plugin-sdk/command-auth-native";
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import type { ResolvedAgentRoute } from "eve-agent/plugin-sdk/routing";
import type {
  ButtonInteraction,
  CommandInteraction,
  StringSelectMenuInteraction,
} from "../internal/discord.js";
import type { ThreadBindingManager } from "./thread-bindings.js";

type DiscordConfig = NonNullable<EVEConfig["channels"]>["discord"];

export type DispatchDiscordCommandInteractionParams = {
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction;
  prompt: string;
  command: ChatCommandDefinition;
  commandArgs?: CommandArgs;
  cfg: EVEConfig;
  discordConfig: DiscordConfig;
  accountId: string;
  sessionPrefix: string;
  preferFollowUp: boolean;
  threadBindings: ThreadBindingManager;
  responseEphemeral?: boolean;
  suppressReplies?: boolean;
};

export type DispatchDiscordCommandInteractionResult = {
  accepted: boolean;
  effectiveRoute?: ResolvedAgentRoute;
};

export type DispatchDiscordCommandInteraction = (
  params: DispatchDiscordCommandInteractionParams,
) => Promise<DispatchDiscordCommandInteractionResult>;
