import type { Command } from "commander";
import {
  allowEveAction,
  createEmptyEvePolicy,
  EVE_POLICY_VERSION,
} from "./contract.js";

export function registerPolicyCli(program: Command): void {
  program
    .command("policy")
    .description("Show the EVE-owned behavioral policy contract")
    .option("--json", "Emit JSON output")
    .action((options: { json?: boolean }) => {
      const report = {
        ok: true,
        mode: "empty-allow-all",
        version: EVE_POLICY_VERSION,
        policy: createEmptyEvePolicy(),
        decision: allowEveAction(),
        note: "No EVE behavioral restrictions are defined in phase one.",
      } as const;
      process.stdout.write(
        options.json === true
          ? `${JSON.stringify(report)}\n`
          : [
              "EVE policy: empty (allow-all)",
              `contract version: ${report.version}`,
              "rules: 0",
              "Future EVE-owned policy rules will be added in phase two.",
              "",
            ].join("\n"),
      );
    });
}
