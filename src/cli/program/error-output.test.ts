// Error output tests cover program-level error display and exit messaging.
import { describe, expect, it } from "vitest";
import { formatCliParseErrorOutput } from "./error-output.js";

describe("formatCliParseErrorOutput", () => {
  it("explains unknown commands with root help and plugin hints", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'wat'\n", {
      argv: ["node", "eve", "wat"],
    });

    expect(output).toBe(
      'EVE does not know the command "wat".\nTry: eve --help\nPlugin command? eve plugins list\nDocs: https://docs.eve.ai/cli\n',
    );
  });

  it("suggests close known commands for unknown commands", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'upate'\n", {
      argv: ["node", "eve", "upate"],
    });

    expect(output).toBe(
      'EVE does not know the command "upate".\nDid you mean this?\n  eve update\nTry: eve --help\nPlugin command? eve plugins list\nDocs: https://docs.eve.ai/cli\n',
    );
  });

  it("suggests explicit aliases for common adjacent terminology", () => {
    const output = formatCliParseErrorOutput("error: unknown command 'upgrade'\n", {
      argv: ["node", "eve", "upgrade"],
    });

    expect(output).toContain("Did you mean this?\n  eve update\n");
  });

  it("preserves active profile context in command suggestions", () => {
    const originalProfile = process.env.EVE_PROFILE;
    process.env.EVE_PROFILE = "work";
    try {
      const output = formatCliParseErrorOutput("error: unknown command 'doctr'\n", {
        argv: ["node", "eve", "doctr"],
      });

      expect(output).toContain("Did you mean this?\n  eve --profile work doctor\n");
    } finally {
      if (originalProfile === undefined) {
        delete process.env.EVE_PROFILE;
      } else {
        process.env.EVE_PROFILE = originalProfile;
      }
    }
  });

  it("points unknown options at the active command help", () => {
    const output = formatCliParseErrorOutput("error: unknown option '--wat'\n", {
      argv: ["node", "eve", "channels", "status", "--wat"],
    });

    expect(output).toBe(
      'EVE does not recognize option "--wat".\nTry: eve channels status --help\n',
    );
  });

  it("points missing required arguments at command help", () => {
    const output = formatCliParseErrorOutput("error: missing required argument 'name'\n", {
      argv: ["node", "eve", "plugins", "install"],
    });

    expect(output).toBe('Missing required argument "name".\nTry: eve plugins install --help\n');
  });
});
