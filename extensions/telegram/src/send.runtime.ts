// Telegram plugin module implements send behavior.
export { requireRuntimeConfig } from "eve-agent/plugin-sdk/plugin-config-runtime";
export { resolveMarkdownTableMode } from "eve-agent/plugin-sdk/markdown-table-runtime";
export type { EVEConfig } from "eve-agent/plugin-sdk/config-contracts";
export type { PollInput, MediaKind } from "eve-agent/plugin-sdk/media-runtime";
export {
  buildOutboundMediaLoadOptions,
  getImageMetadata,
  isGifMedia,
  kindFromMime,
  normalizePollInput,
  probeVideoDimensions,
} from "eve-agent/plugin-sdk/media-runtime";
export { loadWebMedia } from "eve-agent/plugin-sdk/web-media";
