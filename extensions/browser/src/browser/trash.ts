/**
 * Trash helpers for Browser-owned files constrained to user and EVE temp
 * roots.
 */
import os from "node:os";
import { movePathToTrash as movePathToTrashWithAllowedRoots } from "eve-agent/plugin-sdk/browser-config";
import { resolvePreferredEVETmpDir } from "eve-agent/plugin-sdk/temp-path";

/** Moves a path to trash only when it lives under allowed Browser roots. */
export async function movePathToTrash(targetPath: string): Promise<string> {
  return await movePathToTrashWithAllowedRoots(targetPath, {
    allowedRoots: [os.homedir(), resolvePreferredEVETmpDir()],
  });
}
