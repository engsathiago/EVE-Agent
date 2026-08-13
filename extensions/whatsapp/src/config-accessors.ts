// Whatsapp helper module supports config accessors behavior.
import type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
import { resolveWhatsAppAccount } from "./accounts.js";
import { normalizeWhatsAppAllowFromEntries } from "./normalize-target.js";

export function resolveWhatsAppConfigAllowFrom(params: {
  cfg: EVEConfig;
  accountId?: string | null;
}): string[] {
  return [...(resolveWhatsAppAccount(params).allowFrom ?? [])];
}

export function formatWhatsAppConfigAllowFromEntries(allowFrom: Array<string | number>): string[] {
  return normalizeWhatsAppAllowFromEntries(allowFrom);
}

export function resolveWhatsAppConfigDefaultTo(params: {
  cfg: EVEConfig;
  accountId?: string | null;
}): string | undefined {
  const defaultTo = resolveWhatsAppAccount(params).defaultTo?.trim();
  return defaultTo || undefined;
}
