// Defines markdown table config types used by rendering surfaces.
import type { MarkdownTableMode } from "./types.base.js";
import type { EVEConfig } from "./types.eve.js";

/** Parameters for resolving markdown table rendering per config and channel. */
export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<EVEConfig>;
  channel?: string | null;
  accountId?: string | null;
  supportsBlockTables?: boolean;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
