import { normalizeLowercaseStringOrEmpty } from "@eve/normalization-core/string-coerce";
import { normalizeStringEntries } from "@eve/normalization-core/string-normalization";
import { splitShellArgs } from "../utils/shell-argv.js";
import { buildCommandPayloadCandidates } from "./command-analysis/risks.js";
import { explainShellCommand } from "./command-explainer/extract.js";

type ParsedExecApprovalCommand = {
  approvalId: string;
  decision: "allow-once" | "allow-always" | "deny";
};

export type UnsafeExecControlShellCommandKind = "approve" | "channel-login";

export function parseExecApprovalShellCommand(raw: string): ParsedExecApprovalCommand | null {
  const normalized = raw.trimStart();
  const match = normalized.match(
    /^\/approve(?:@[^\s]+)?\s+([A-Za-z0-9][A-Za-z0-9._:-]*)\s+(allow-once|allow-always|always|deny)\b/i,
  );
  if (!match) {
    return null;
  }
  return {
    approvalId: match[1],
    decision:
      normalizeLowercaseStringOrEmpty(match[2]) === "always"
        ? "allow-always"
        : (normalizeLowercaseStringOrEmpty(match[2]) as ParsedExecApprovalCommand["decision"]),
  };
}

function normalizeCommandBaseName(token: string | undefined): string {
  if (!token) {
    return "";
  }
  const base = normalizeLowercaseStringOrEmpty(token.split(/[\\/]/u).at(-1));
  return base.replace(/\.(?:cmd|exe)$/u, "");
}

function stripEVEPackageRunner(argv: string[]): string[] {
  const commandName = normalizeCommandBaseName(argv[0]);
  if (commandName === "eve") {
    return argv;
  }
  if (
    (commandName === "pnpm" || commandName === "npm" || commandName === "yarn") &&
    normalizeCommandBaseName(argv[1]) === "eve"
  ) {
    return argv.slice(1);
  }
  if (
    (commandName === "pnpm" || commandName === "npm" || commandName === "yarn") &&
    (argv[1] === "exec" || argv[1] === "dlx" || argv[1] === "run") &&
    normalizeCommandBaseName(argv[2]) === "eve"
  ) {
    return argv.slice(2);
  }
  if (commandName === "npx" || commandName === "bunx") {
    let idx = 1;
    while (idx < argv.length) {
      const token = argv[idx];
      if (token === "--") {
        idx += 1;
        break;
      }
      if (!token.startsWith("-") || token === "-") {
        break;
      }
      idx += 1;
      if ((token === "-p" || token === "--package") && idx < argv.length) {
        idx += 1;
      }
    }
    if (normalizeCommandBaseName(argv[idx]) === "eve") {
      return argv.slice(idx);
    }
  }
  return argv;
}

export function parseEVEChannelsLoginShellCommand(raw: string): boolean {
  const argv = splitShellArgs(raw);
  if (!argv) {
    return false;
  }
  const eveArgv = stripEVEPackageRunner(argv);
  return (
    normalizeCommandBaseName(eveArgv[0]) === "eve" &&
    (eveArgv[1] === "channels" || eveArgv[1] === "channel") &&
    eveArgv[2] === "login"
  );
}

export async function detectUnsafeExecControlShellCommand(
  command: string,
): Promise<UnsafeExecControlShellCommandKind | null> {
  const rawCommand = command.trim();
  const candidates = await (async () => {
    try {
      const explanation = await explainShellCommand(rawCommand);
      if (explanation.ok) {
        const commands = [...explanation.topLevelCommands, ...explanation.nestedCommands];
        return commands.flatMap((step) => buildCommandPayloadCandidates(step.argv));
      }
    } catch {
      // Fall back to line-local shell splitting below.
    }
    return normalizeStringEntries(rawCommand.split(/\r?\n/)).flatMap((line) => {
      const argv = splitShellArgs(line);
      return argv ? buildCommandPayloadCandidates(argv) : [line];
    });
  })();
  for (const candidate of candidates) {
    if (parseExecApprovalShellCommand(candidate)) {
      return "approve";
    }
    if (parseEVEChannelsLoginShellCommand(candidate)) {
      return "channel-login";
    }
  }
  return null;
}

export async function rejectUnsafeExecControlShellCommand(command: string): Promise<void> {
  const unsafeKind = await detectUnsafeExecControlShellCommand(command);
  if (unsafeKind === "approve") {
    throw new Error(
      [
        "exec cannot run /approve commands.",
        "Show the /approve command to the user as chat text, or route it through the approval command handler instead of shell execution.",
      ].join(" "),
    );
  }
  if (unsafeKind === "channel-login") {
    throw new Error(
      [
        "exec cannot run interactive EVE channel login commands.",
        "Run `eve channels login` in a terminal on the gateway host, or use the channel-specific login agent tool when available (for WhatsApp: `whatsapp_login`).",
      ].join(" "),
    );
  }
}
