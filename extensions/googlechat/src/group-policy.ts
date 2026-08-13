// Googlechat plugin module implements group policy behavior.
import { resolveChannelGroupRequireMention } from "eve-agent/plugin-sdk/channel-policy";
import type { EVEConfig } from "eve-agent/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: EVEConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
