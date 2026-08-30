import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerEvalCommands } from "./cli-flows-evals.js";
import type { IntelligenceServices } from "./services.js";

let previousExitCode: typeof process.exitCode;

beforeEach(() => {
  previousExitCode = process.exitCode;
  process.exitCode = undefined;
});

afterEach(() => {
  process.exitCode = previousExitCode;
  vi.restoreAllMocks();
});

describe("intelligence eval CLI", () => {
  it("returns a failing process status when an eval CI gate rejects", async () => {
    const ci = vi.fn().mockResolvedValue({
      accepted: false,
      decision: "reject",
      reasons: ["score below threshold"],
    });
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const program = new Command();
    registerEvalCommands(program, { evals: { ci } } as unknown as IntelligenceServices);

    await program.parseAsync(["node", "eve", "evals", "ci", "suite", "--json"]);

    expect(process.exitCode).toBe(1);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"decision": "reject"'));
  });
});
