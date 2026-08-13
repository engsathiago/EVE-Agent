// Line API module exposes the plugin public contract.
export { clearAccountEntryFields } from "eve-agent/plugin-sdk/core";
import { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/account-id";
import type { EVEConfig } from "eve-agent/plugin-sdk/account-resolution";
import type { ChannelPlugin } from "eve-agent/plugin-sdk/core";
import { listLineAccountIds, resolveDefaultLineAccountId, resolveLineAccount } from "./accounts.js";
import { resolveExactLineGroupConfigKey } from "./group-keys.js";
import type { LineConfig, ResolvedLineAccount } from "./types.js";

export {
  DEFAULT_ACCOUNT_ID,
  listLineAccountIds,
  resolveDefaultLineAccountId,
  resolveExactLineGroupConfigKey,
  resolveLineAccount,
};

export type { ChannelPlugin, LineConfig, EVEConfig, ResolvedLineAccount };
