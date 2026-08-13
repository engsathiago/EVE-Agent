/** Doctor warning for missing command owners on privileged channel commands. */
import { normalizeOptionalString } from "@eve/normalization-core/string-coerce";
import { normalizeStringEntries } from "@eve/normalization-core/string-normalization";
import { note } from "../../packages/terminal-core/src/note.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { EVEConfig } from "../config/types.eve.js";
import type { PairingChannel } from "../pairing/pairing-store.types.js";

function resolveConfiguredCommandOwners(cfg: EVEConfig): string[] {
  const owners = cfg.commands?.ownerAllowFrom;
  if (!Array.isArray(owners)) {
    return [];
  }
  return normalizeStringEntries(owners.map((entry) => String(entry ?? "")));
}

/** Returns true when at least one owner sender id is configured. */
export function hasConfiguredCommandOwners(cfg: EVEConfig): boolean {
  return resolveConfiguredCommandOwners(cfg).length > 0;
}

/** Formats a channel sender id into the commands.ownerAllowFrom entry shape. */
export function formatCommandOwnerFromChannelSender(params: {
  channel: PairingChannel;
  id: string;
}): string | null {
  const id = normalizeOptionalString(params.id);
  if (!id) {
    return null;
  }
  const separatorIndex = id.indexOf(":");
  if (separatorIndex > 0) {
    const prefix = id.slice(0, separatorIndex);
    if (prefix.toLowerCase() === String(params.channel).toLowerCase()) {
      return id;
    }
  }
  return `${params.channel}:${id}`;
}

/** Emits setup guidance when privileged command ownership is not configured. */
export function noteCommandOwnerHealth(cfg: EVEConfig): void {
  if (hasConfiguredCommandOwners(cfg)) {
    return;
  }
  note(
    [
      "No command owner is configured.",
      "A command owner is the human operator account allowed to run owner-only commands and approve dangerous actions, including /diagnostics, /export-trajectory, /config, and exec approvals.",
      "DM pairing only lets someone talk to the bot; it does not make that sender the owner for privileged commands.",
      `Fix: set commands.ownerAllowFrom to your channel user id, for example ${formatCliCommand("eve config set commands.ownerAllowFrom '[\"telegram:123456789\"]'")}`,
      "Restart the gateway after changing this if it is already running.",
    ].join("\n"),
    "Command owner",
  );
}
