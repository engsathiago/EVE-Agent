// Failure output tests cover CLI error formatting and failure summaries.
import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "eve", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[eve] Could not start the CLI.",
      "[eve] Reason: config file is invalid",
      "[eve] Debug: set EVE_DEBUG=1 to include the stack trace.",
      "[eve] Try: eve doctor",
      "[eve] Help: eve --help",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { EVE_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[eve] The CLI command failed.",
      "[eve] Reason: boom",
      "[eve] Stack:",
      "[eve] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
