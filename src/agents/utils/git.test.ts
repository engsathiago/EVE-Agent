// Git utility tests cover plugin git source parsing, ref extraction, and path
// traversal rejection before managed checkouts are created.
import { describe, expect, it } from "vitest";
import { parseGitUrl } from "./git.js";

describe("parseGitUrl", () => {
  it("parses ordinary hosted git sources", () => {
    expect(parseGitUrl("git:github.com/eve/example-plugin")).toMatchObject({
      type: "git",
      host: "github.com",
      path: "eve/example-plugin",
      repo: "https://github.com/eve/example-plugin",
    });
  });

  it("parses refs from hosted, scp-style, and generic shorthand sources", () => {
    expect(parseGitUrl("git:https://github.com/eve/example-plugin.git@v1.2.3")).toMatchObject({
      host: "github.com",
      path: "eve/example-plugin",
      repo: "https://github.com/eve/example-plugin.git",
      ref: "v1.2.3",
      pinned: true,
    });
    expect(parseGitUrl("git:git@github.com:eve/example-plugin.git@feature/foo")).toMatchObject({
      host: "github.com",
      path: "eve/example-plugin",
      repo: "git@github.com:eve/example-plugin.git",
      ref: "feature/foo",
      pinned: true,
    });
    expect(parseGitUrl("git:example.com/eve/example-plugin@main")).toMatchObject({
      host: "example.com",
      path: "eve/example-plugin",
      repo: "https://example.com/eve/example-plugin",
      ref: "main",
      pinned: true,
    });
  });

  it("rejects repository paths that could escape managed checkout roots", () => {
    // Managed plugin checkouts derive local paths from repo path segments, so
    // dot-segments are rejected instead of normalized.
    expect(parseGitUrl("git:https://example.com/eve/../outside")).toBeNull();
    expect(parseGitUrl("git:git@example.com:eve/../outside")).toBeNull();
    expect(parseGitUrl("git:example.com/eve/./outside")).toBeNull();
  });
});
