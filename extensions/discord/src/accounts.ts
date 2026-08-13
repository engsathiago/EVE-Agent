// Discord plugin module implements accounts behavior.
import {
  createAccountActionGate,
  createAccountListHelpers,
  resolveMergedAccountConfig,
} from "eve-agent/plugin-sdk/account-helpers";
import { normalizeAccountId } from "eve-agent/plugin-sdk/account-id";
import {
  mapAllowFromEntries,
  normalizeChannelDmPolicy,
  resolveChannelDmAllowFrom,
  resolveChannelDmPolicy,
  type ChannelDmPolicy,
} from "eve-agent/plugin-sdk/channel-config-helpers";
import { resolveAccountEntry } from "eve-agent/plugin-sdk/routing";
import { normalizeOptionalString } from "eve-agent/plugin-sdk/string-coerce-runtime";
import type { DiscordAccountConfig, DiscordActionConfig, EVEConfig } from "./runtime-api.js";
import { selectDiscordRuntimeConfig } from "./runtime-config.js";
import { resolveDiscordToken, type DiscordCredentialStatus } from "./token.js";

export type ResolvedDiscordAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  token: string;
  tokenSource: "env" | "config" | "none";
  tokenStatus: DiscordCredentialStatus;
  config: DiscordAccountConfig;
};

const { listAccountIds, resolveDefaultAccountId } = createAccountListHelpers("discord", {
  implicitDefaultAccount: {
    channelKeys: ["token"],
    envVars: ["DISCORD_BOT_TOKEN"],
  },
});
export const listDiscordAccountIds = listAccountIds;
export const resolveDefaultDiscordAccountId = resolveDefaultAccountId;

export function resolveDiscordAccountConfig(
  cfg: EVEConfig,
  accountId: string,
): DiscordAccountConfig | undefined {
  return resolveAccountEntry(cfg.channels?.discord?.accounts, accountId);
}

export function mergeDiscordAccountConfig(
  cfg: EVEConfig,
  accountId: string,
): DiscordAccountConfig {
  const merged = resolveMergedAccountConfig<DiscordAccountConfig>({
    channelConfig: cfg.channels?.discord as DiscordAccountConfig | undefined,
    accounts: cfg.channels?.discord?.accounts as
      | Record<string, Partial<DiscordAccountConfig>>
      | undefined,
    accountId,
    nestedObjectKeys: ["agentComponents", "botLoopProtection"],
  });
  return merged;
}

export function resolveDiscordAccountAllowFrom(params: {
  cfg: EVEConfig;
  accountId?: string | null;
}): string[] | undefined {
  const accountId = normalizeAccountId(
    params.accountId ?? resolveDefaultDiscordAccountId(params.cfg),
  );
  const accountConfig = resolveDiscordAccountConfig(params.cfg, accountId);
  const rootConfig = params.cfg.channels?.discord as DiscordAccountConfig | undefined;

  const allowFrom = resolveChannelDmAllowFrom({
    account: accountConfig as Record<string, unknown> | undefined,
    parent: rootConfig as Record<string, unknown> | undefined,
  });
  return allowFrom ? mapAllowFromEntries(allowFrom) : undefined;
}

export function resolveDiscordAccountDmPolicy(params: {
  cfg: EVEConfig;
  accountId?: string | null;
}): ChannelDmPolicy | undefined {
  const accountId = normalizeAccountId(
    params.accountId ?? resolveDefaultDiscordAccountId(params.cfg),
  );
  const accountConfig = resolveDiscordAccountConfig(params.cfg, accountId);
  const rootConfig = params.cfg.channels?.discord as DiscordAccountConfig | undefined;
  const policy = resolveChannelDmPolicy({
    account: accountConfig as Record<string, unknown> | undefined,
    parent: rootConfig as Record<string, unknown> | undefined,
    defaultPolicy: "pairing",
  });
  return normalizeChannelDmPolicy(policy);
}

export function createDiscordActionGate(params: {
  cfg: EVEConfig;
  accountId?: string | null;
}): (key: keyof DiscordActionConfig, defaultValue?: boolean) => boolean {
  const accountId = normalizeAccountId(
    params.accountId ?? resolveDefaultDiscordAccountId(params.cfg),
  );
  return createAccountActionGate({
    baseActions: params.cfg.channels?.discord?.actions,
    accountActions: resolveDiscordAccountConfig(params.cfg, accountId)?.actions,
  });
}

export function resolveDiscordAccount(params: {
  cfg: EVEConfig;
  accountId?: string | null;
}): ResolvedDiscordAccount {
  const cfg = selectDiscordRuntimeConfig(params.cfg);
  const accountId = normalizeAccountId(params.accountId ?? resolveDefaultDiscordAccountId(cfg));
  const baseEnabled = cfg.channels?.discord?.enabled !== false;
  const merged = mergeDiscordAccountConfig(cfg, accountId);
  const accountEnabled = merged.enabled !== false;
  const enabled = baseEnabled && accountEnabled;
  const tokenResolution = resolveDiscordToken(cfg, { accountId });
  return {
    accountId,
    enabled,
    name: normalizeOptionalString(merged.name),
    token: tokenResolution.token,
    tokenSource: tokenResolution.source,
    tokenStatus: tokenResolution.tokenStatus,
    config: merged,
  };
}

export function resolveDiscordMaxLinesPerMessage(params: {
  cfg: EVEConfig;
  discordConfig?: DiscordAccountConfig | null;
  accountId?: string | null;
}): number | undefined {
  if (typeof params.discordConfig?.maxLinesPerMessage === "number") {
    return params.discordConfig.maxLinesPerMessage;
  }
  return resolveDiscordAccount({
    cfg: params.cfg,
    accountId: params.accountId,
  }).config.maxLinesPerMessage;
}

function resolveDiscordAccountTokenOwner(params: {
  cfg: EVEConfig;
  token: string;
}): string | undefined {
  const token = params.token.trim();
  if (!token) {
    return undefined;
  }
  let owner: { accountId: string; priority: number; index: number } | undefined;
  const accountIds = listDiscordAccountIds(params.cfg);
  for (const [index, accountId] of accountIds.entries()) {
    const account = resolveDiscordAccount({ cfg: params.cfg, accountId });
    const accountToken = account.token.trim();
    if (!account.enabled || accountToken !== token) {
      continue;
    }
    const priority = account.tokenSource === "config" ? 2 : account.tokenSource === "env" ? 1 : 0;
    if (!owner || priority > owner.priority) {
      owner = { accountId: account.accountId, priority, index };
      continue;
    }
    if (priority === owner.priority && index < owner.index) {
      owner = { accountId: account.accountId, priority, index };
    }
  }
  return owner?.accountId;
}

function resolveDiscordDuplicateTokenOwner(params: {
  cfg: EVEConfig;
  account: ResolvedDiscordAccount;
}): string | undefined {
  const owner = resolveDiscordAccountTokenOwner({
    cfg: params.cfg,
    token: params.account.token,
  });
  return owner && owner !== params.account.accountId ? owner : undefined;
}

export function isDiscordAccountEnabledForRuntime(
  account: ResolvedDiscordAccount,
  cfg: EVEConfig,
): boolean {
  return account.enabled && !resolveDiscordDuplicateTokenOwner({ cfg, account });
}

export function resolveDiscordAccountDisabledReason(
  account: ResolvedDiscordAccount,
  cfg: EVEConfig,
): string {
  if (!account.enabled) {
    return "disabled";
  }
  const owner = resolveDiscordDuplicateTokenOwner({ cfg, account });
  return owner ? `duplicate bot token; using account "${owner}"` : "disabled";
}

export function listEnabledDiscordAccounts(cfg: EVEConfig): ResolvedDiscordAccount[] {
  return listDiscordAccountIds(cfg)
    .map((accountId) => resolveDiscordAccount({ cfg, accountId }))
    .filter((account) => isDiscordAccountEnabledForRuntime(account, cfg));
}
