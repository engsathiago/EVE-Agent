// Slack plugin module implements media behavior.
export { fetchWithRuntimeDispatcher } from "eve-agent/plugin-sdk/runtime-fetch";
export type { FetchLike, SavedMedia } from "eve-agent/plugin-sdk/media-runtime";
export {
  readRemoteMediaBuffer,
  saveMediaBuffer,
  saveRemoteMedia,
} from "eve-agent/plugin-sdk/media-runtime";
export { logVerbose } from "eve-agent/plugin-sdk/runtime-env";
