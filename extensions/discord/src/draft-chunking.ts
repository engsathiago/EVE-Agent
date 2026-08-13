// Discord plugin module implements draft chunking behavior.
import {
  resolveChannelDraftStreamingChunking,
  type ChannelDraftStreamingChunking,
} from "eve-agent/plugin-sdk/channel-outbound";
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import { DISCORD_TEXT_CHUNK_LIMIT } from "./outbound-adapter.js";

export function resolveDiscordDraftStreamingChunking(
  cfg: EVEConfig,
  accountId?: string | null,
): ChannelDraftStreamingChunking {
  return resolveChannelDraftStreamingChunking(cfg, "discord", accountId, {
    fallbackLimit: DISCORD_TEXT_CHUNK_LIMIT,
  });
}
