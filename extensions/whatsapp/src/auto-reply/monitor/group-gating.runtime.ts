// Whatsapp plugin module implements group gating behavior.
export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "eve-agent/plugin-sdk/channel-mention-gating";
export { hasControlCommand } from "eve-agent/plugin-sdk/command-detection";
export { createChannelHistoryWindow } from "eve-agent/plugin-sdk/reply-history";
export { parseActivationCommand } from "eve-agent/plugin-sdk/group-activation";
export { normalizeE164 } from "../../text-runtime.js";
