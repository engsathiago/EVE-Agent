/**
 * Browser-local SDK setup/tooling bridge for CLI, media, and action helpers.
 */
export {
  callGatewayTool,
  listNodes,
  resolveNodeIdFromList,
  selectDefaultNodeFromList,
} from "eve-agent/plugin-sdk/agent-harness-runtime";
export type { AnyAgentTool, NodeListNode } from "eve-agent/plugin-sdk/agent-harness-runtime";
export {
  imageResultFromFile,
  jsonResult,
  readPositiveIntegerParam,
  readStringParam,
} from "eve-agent/plugin-sdk/channel-actions";
export { optionalStringEnum, stringEnum } from "eve-agent/plugin-sdk/channel-actions";
export {
  formatCliCommand,
  formatHelpExamples,
  inheritOptionFromParent,
  note,
  theme,
} from "eve-agent/plugin-sdk/cli-runtime";
export { danger, info } from "eve-agent/plugin-sdk/runtime-env";
export {
  IMAGE_REDUCE_QUALITY_STEPS,
  buildImageResizeSideGrid,
  getImageMetadata,
  isImageProcessorUnavailableError,
  resizeToJpeg,
} from "eve-agent/plugin-sdk/media-runtime";
export { detectMime } from "eve-agent/plugin-sdk/media-mime";
export { ensureMediaDir, saveMediaBuffer } from "eve-agent/plugin-sdk/media-runtime";
export { describeImageFile } from "eve-agent/plugin-sdk/media-understanding-runtime";
export { formatDocsLink } from "eve-agent/plugin-sdk/setup-tools";
