// Normalizes agent prompt surface kinds advertised by plugins.
import type { AgentPromptSurfaceKind } from "./types.js";

/** Normalizes legacy prompt surface names to current EVE surface names. */
export function normalizeAgentPromptSurfaceKind(
  surface: AgentPromptSurfaceKind,
): AgentPromptSurfaceKind {
  return surface === "pi_main" ? "eve_main" : surface;
}

/** True when a prompt surface targets the main EVE prompt. */
export function isEVEMainPromptSurface(surface: AgentPromptSurfaceKind): boolean {
  return normalizeAgentPromptSurfaceKind(surface) === "eve_main";
}
