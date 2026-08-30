import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendStructuredReflection } from "./reflection.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("structured reflection", () => {
  it("appends normalized fields to daily memory", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "eve-reflection-"));
    roots.push(root);
    const result = await appendStructuredReflection(root, {
      delivered: "  shipped\n the feature ",
      quality: "tests passed",
      lesson: "keep evidence close",
      now: new Date("2026-08-20T12:34:56.000Z"),
    });

    expect(result.path).toBe(path.join(root, "memory", "2026-08-20.md"));
    await expect(fs.readFile(result.path, "utf8")).resolves.toContain(
      "- Delivered: shipped the feature",
    );
    await expect(fs.readFile(result.path, "utf8")).resolves.toContain(
      "- Lesson: keep evidence close",
    );
  });

  it("rejects an empty reflection", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "eve-reflection-empty-"));
    roots.push(root);
    await expect(appendStructuredReflection(root, {})).rejects.toThrow(
      "reflection requires at least one",
    );
  });
});
