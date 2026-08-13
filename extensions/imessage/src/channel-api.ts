// Imessage API module exposes the plugin public contract.
import { formatTrimmedAllowFromEntries } from "eve-agent/plugin-sdk/channel-config-helpers";
import { PAIRING_APPROVED_MESSAGE } from "eve-agent/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
} from "eve-agent/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "eve-agent/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "eve-agent/plugin-sdk/status-helpers";
import { normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "eve-agent/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
};

export type { ChannelPlugin };
