// Slack API module exposes the plugin public contract.
export {
  buildComputedAccountStatusSnapshot,
  PAIRING_APPROVED_MESSAGE,
  projectCredentialSnapshotFields,
  resolveConfiguredFromRequiredCredentialStatuses,
} from "eve-agent/plugin-sdk/channel-status";
export { buildChannelConfigSchema, SlackConfigSchema } from "../config-api.js";
export type { ChannelMessageActionContext } from "eve-agent/plugin-sdk/channel-contract";
export { DEFAULT_ACCOUNT_ID } from "eve-agent/plugin-sdk/account-id";
export type {
  ChannelPlugin,
  EVEPluginApi,
  PluginRuntime,
} from "eve-agent/plugin-sdk/channel-plugin-common";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export type { SlackAccountConfig } from "eve-agent/plugin-sdk/config-contracts";
export {
  emptyPluginConfigSchema,
  formatPairingApproveHint,
} from "eve-agent/plugin-sdk/channel-plugin-common";
export { loadOutboundMediaFromUrl } from "eve-agent/plugin-sdk/outbound-media";
export { looksLikeSlackTargetId, normalizeSlackMessagingTarget } from "./target-parsing.js";
export { getChatChannelMeta } from "./channel-api.js";
export {
  createActionGate,
  imageResultFromFile,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringParam,
  withNormalizedTimestamp,
} from "eve-agent/plugin-sdk/channel-actions";
