// Telegram plugin module implements bot deps behavior.
import { recordChannelActivity } from "eve-agent/plugin-sdk/channel-activity-runtime";
import { buildChannelInboundEventContext } from "eve-agent/plugin-sdk/channel-inbound";
import {
  createChannelMessageReplyPipeline,
  deliverInboundReplyWithMessageSendContext,
} from "eve-agent/plugin-sdk/channel-outbound";
import { readChannelAllowFromStore } from "eve-agent/plugin-sdk/conversation-runtime";
import {
  recordInboundSession,
  upsertChannelPairingRequest,
} from "eve-agent/plugin-sdk/conversation-runtime";
import { buildModelsProviderData } from "eve-agent/plugin-sdk/models-provider-runtime";
import { dispatchReplyWithBufferedBlockDispatcher } from "eve-agent/plugin-sdk/reply-dispatch-runtime";
import { resolveInboundLastRouteSessionKey } from "eve-agent/plugin-sdk/routing";
import { getRuntimeConfig } from "eve-agent/plugin-sdk/runtime-config-snapshot";
import { resolvePinnedMainDmOwnerFromAllowlist } from "eve-agent/plugin-sdk/security-runtime";
import {
  getSessionEntry,
  listSessionEntries,
  readSessionUpdatedAt,
  resolveStorePath,
} from "eve-agent/plugin-sdk/session-store-runtime";
import { loadSessionStore } from "eve-agent/plugin-sdk/session-store-runtime";
import { listSkillCommandsForAgents } from "eve-agent/plugin-sdk/skill-commands-runtime";
import { enqueueSystemEvent } from "eve-agent/plugin-sdk/system-event-runtime";
import { loadWebMedia } from "eve-agent/plugin-sdk/web-media";
import { syncTelegramMenuCommands } from "./bot-native-command-menu.js";
import { deliverReplies, emitInternalMessageSentHook } from "./bot/delivery.js";
import { createTelegramDraftStream } from "./draft-stream.js";
import { resolveTelegramExecApproval } from "./exec-approval-resolver.js";
import { recordOutboundMessageForPromptContext } from "./outbound-message-context.js";
import { editMessageTelegram } from "./send.js";
import { wasSentByBot } from "./sent-message-cache.js";

export type TelegramBotDeps = {
  getRuntimeConfig: typeof getRuntimeConfig;
  resolveStorePath: typeof resolveStorePath;
  getSessionEntry?: typeof getSessionEntry;
  listSessionEntries?: typeof listSessionEntries;
  loadSessionStore?: typeof loadSessionStore;
  readSessionUpdatedAt?: typeof readSessionUpdatedAt;
  recordInboundSession?: typeof recordInboundSession;
  recordChannelActivity?: typeof recordChannelActivity;
  resolveInboundLastRouteSessionKey?: typeof resolveInboundLastRouteSessionKey;
  resolvePinnedMainDmOwnerFromAllowlist?: typeof resolvePinnedMainDmOwnerFromAllowlist;
  buildChannelInboundEventContext?: typeof buildChannelInboundEventContext;
  readChannelAllowFromStore: typeof readChannelAllowFromStore;
  upsertChannelPairingRequest: typeof upsertChannelPairingRequest;
  enqueueSystemEvent: typeof enqueueSystemEvent;
  dispatchReplyWithBufferedBlockDispatcher: typeof dispatchReplyWithBufferedBlockDispatcher;
  loadWebMedia?: typeof loadWebMedia;
  buildModelsProviderData: typeof buildModelsProviderData;
  listSkillCommandsForAgents: typeof listSkillCommandsForAgents;
  syncTelegramMenuCommands?: typeof syncTelegramMenuCommands;
  wasSentByBot: typeof wasSentByBot;
  resolveExecApproval?: typeof resolveTelegramExecApproval;
  createTelegramDraftStream?: typeof createTelegramDraftStream;
  deliverReplies?: typeof deliverReplies;
  deliverInboundReplyWithMessageSendContext?: typeof deliverInboundReplyWithMessageSendContext;
  emitInternalMessageSentHook?: typeof emitInternalMessageSentHook;
  editMessageTelegram?: typeof editMessageTelegram;
  recordOutboundMessageForPromptContext?: typeof recordOutboundMessageForPromptContext;
  createChannelMessageReplyPipeline?: typeof createChannelMessageReplyPipeline;
};

export const defaultTelegramBotDeps: TelegramBotDeps = {
  get getRuntimeConfig() {
    return getRuntimeConfig;
  },
  get resolveStorePath() {
    return resolveStorePath;
  },
  get getSessionEntry() {
    return getSessionEntry;
  },
  get listSessionEntries() {
    return listSessionEntries;
  },
  get readChannelAllowFromStore() {
    return readChannelAllowFromStore;
  },
  get loadSessionStore() {
    return loadSessionStore;
  },
  get readSessionUpdatedAt() {
    return readSessionUpdatedAt;
  },
  get recordInboundSession() {
    return recordInboundSession;
  },
  get recordChannelActivity() {
    return recordChannelActivity;
  },
  get resolveInboundLastRouteSessionKey() {
    return resolveInboundLastRouteSessionKey;
  },
  get resolvePinnedMainDmOwnerFromAllowlist() {
    return resolvePinnedMainDmOwnerFromAllowlist;
  },
  get buildChannelInboundEventContext() {
    return buildChannelInboundEventContext;
  },
  get upsertChannelPairingRequest() {
    return upsertChannelPairingRequest;
  },
  get enqueueSystemEvent() {
    return enqueueSystemEvent;
  },
  get dispatchReplyWithBufferedBlockDispatcher() {
    return dispatchReplyWithBufferedBlockDispatcher;
  },
  get loadWebMedia() {
    return loadWebMedia;
  },
  get buildModelsProviderData() {
    return buildModelsProviderData;
  },
  get listSkillCommandsForAgents() {
    return listSkillCommandsForAgents;
  },
  get syncTelegramMenuCommands() {
    return syncTelegramMenuCommands;
  },
  get wasSentByBot() {
    return wasSentByBot;
  },
  get resolveExecApproval() {
    return resolveTelegramExecApproval;
  },
  get createTelegramDraftStream() {
    return createTelegramDraftStream;
  },
  get deliverReplies() {
    return deliverReplies;
  },
  get deliverInboundReplyWithMessageSendContext() {
    return deliverInboundReplyWithMessageSendContext;
  },
  get emitInternalMessageSentHook() {
    return emitInternalMessageSentHook;
  },
  get editMessageTelegram() {
    return editMessageTelegram;
  },
  get recordOutboundMessageForPromptContext() {
    return recordOutboundMessageForPromptContext;
  },
  get createChannelMessageReplyPipeline() {
    return createChannelMessageReplyPipeline;
  },
};
