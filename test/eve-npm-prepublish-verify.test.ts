import { describe, expect, it } from "vitest";
import {
  eveNpmPrepublishVerifyUsage,
  parseEVENpmPrepublishVerifyArgs,
} from "../scripts/eve-npm-prepublish-verify.ts";

describe("parseEVENpmPrepublishVerifyArgs", () => {
  it("supports help, optional versions, and package-manager separators", () => {
    expect(parseEVENpmPrepublishVerifyArgs(["--help"])).toEqual({
      help: true,
      tarballPath: "",
    });
    expect(parseEVENpmPrepublishVerifyArgs(["eve.tgz"])).toEqual({
      help: false,
      tarballPath: "eve.tgz",
    });
    expect(parseEVENpmPrepublishVerifyArgs(["--", "eve.tgz", "2026.3.23"])).toEqual({
      expectedVersion: "2026.3.23",
      help: false,
      tarballPath: "eve.tgz",
    });
  });

  it("rejects missing, option-like, and extra arguments before installing", () => {
    expect(() => parseEVENpmPrepublishVerifyArgs([])).toThrow(eveNpmPrepublishVerifyUsage());
    expect(() => parseEVENpmPrepublishVerifyArgs(["--tag"])).toThrow(
      "Unknown eve npm prepublish verifier option: --tag",
    );
    expect(() => parseEVENpmPrepublishVerifyArgs(["eve.tgz", "--tag"])).toThrow(
      "Unknown eve npm prepublish verifier option: --tag",
    );
    expect(() => parseEVENpmPrepublishVerifyArgs(["eve.tgz", "2026.3.23", "extra"])).toThrow(
      "Unexpected eve npm prepublish verifier argument: extra",
    );
  });
});
