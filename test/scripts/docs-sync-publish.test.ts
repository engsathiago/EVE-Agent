import { describe, expect, it } from "vitest";
import { parseArgs } from "../../scripts/docs-sync-publish.mjs";

describe("docs-sync-publish", () => {
  it("parses docs sync provenance args", () => {
    expect(
      parseArgs([
        "--target",
        "generated-docs",
        "--source-repo",
        "eve/eve",
        "--source-sha",
        "abc123",
        "--clawhub-repo",
        "../clawhub",
        "--clawhub-source-repo",
        "eve/clawhub",
        "--clawhub-source-sha",
        "def456",
      ]),
    ).toMatchObject({
      clawhubRepo: "../clawhub",
      clawhubSourceRepo: "eve/clawhub",
      clawhubSourceSha: "def456",
      sourceRepo: "eve/eve",
      sourceSha: "abc123",
      target: "generated-docs",
    });
  });

  it("rejects missing docs sync option values", () => {
    for (const flag of [
      "--target",
      "--source-repo",
      "--source-sha",
      "--clawhub-repo",
      "--clawhub-source-repo",
      "--clawhub-source-sha",
    ]) {
      expect(() => parseArgs([flag])).toThrow(`${flag} requires a value`);
      expect(() => parseArgs([flag, "--target", "generated-docs"])).toThrow(
        `${flag} requires a value`,
      );
    }
  });
});
