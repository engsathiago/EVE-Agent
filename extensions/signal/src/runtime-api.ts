// Private runtime barrel for the bundled Signal extension.
// Prefer narrower SDK subpaths plus local extension seams over the legacy signal barrel.

export type { ChannelMessageActionAdapter } from "eve-agent/plugin-sdk/channel-contract";
export { buildChannelConfigSchema, SignalConfigSchema } from "../config-api.js";
export { PAIRING_APPROVED_MESSAGE } from "eve-agent/plugin-sdk/channel-status";
import type { EVEConfig as RuntimeEVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export type { RuntimeEVEConfig as EVEConfig };
export type { EVEPluginApi, PluginRuntime } from "eve-agent/plugin-sdk/core";
export type { ChannelPlugin } from "eve-agent/plugin-sdk/core";
export {
  DEFAULT_ACCOUNT_ID,
  applyAccountNameToChannelSection,
  deleteAccountFromConfigSection,
  emptyPluginConfigSchema,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
} from "eve-agent/plugin-sdk/core";
export { resolveChannelMediaMaxBytes } from "eve-agent/plugin-sdk/media-runtime";
export { formatCliCommand, formatDocsLink } from "eve-agent/plugin-sdk/setup-tools";
export { chunkText } from "eve-agent/plugin-sdk/reply-runtime";
export { detectBinary } from "eve-agent/plugin-sdk/setup-tools";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
} from "eve-agent/plugin-sdk/runtime-group-policy";
export {
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
} from "eve-agent/plugin-sdk/status-helpers";
export { normalizeE164 } from "eve-agent/plugin-sdk/text-utility-runtime";
export { looksLikeSignalTargetId, normalizeSignalMessagingTarget } from "./normalize.js";
export {
  listEnabledSignalAccounts,
  listSignalAccountIds,
  resolveDefaultSignalAccountId,
  resolveSignalAccount,
} from "./accounts.js";
export { monitorSignalProvider } from "./monitor.js";
export { installSignalCli } from "./install-signal-cli.js";
export { probeSignal } from "./probe.js";
export { resolveSignalReactionLevel } from "./reaction-level.js";
export { removeReactionSignal, sendReactionSignal } from "./send-reactions.js";
export { sendMessageSignal } from "./send.js";
export { signalMessageActions } from "./message-actions.js";
export type { ResolvedSignalAccount } from "./accounts.js";
export type { SignalAccountConfig } from "./account-types.js";
