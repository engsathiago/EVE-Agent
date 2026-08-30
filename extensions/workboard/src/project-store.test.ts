import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectStore } from "./project-store.js";

const cleanup: string[] = [];

afterEach(() => {
  for (const directory of cleanup.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("EVE projects", () => {
  it("persists multi-folder projects and selects the longest matching root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eve-projects-"));
    cleanup.push(root);
    const repository = path.join(root, "repository");
    const packageRoot = path.join(repository, "packages", "app");
    const unrelatedLongFolder = path.join(root, "an-unrelated-folder-with-a-much-longer-path");
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(unrelatedLongFolder, { recursive: true });
    const store = new ProjectStore(path.join(root, "projects.sqlite"));
    try {
      const broad = store.create({
        name: "Repository",
        folders: [repository, unrelatedLongFolder],
      });
      const focused = store.create({ name: "Application", folders: [packageRoot] });
      expect(store.match(path.join(packageRoot, "src"))?.id).toBe(focused.id);
      expect(store.get("repository").id).toBe(broad.id);
      expect(store.addFolder(broad.id, packageRoot, { primary: true }).primaryPath).toBe(
        packageRoot,
      );
      const unchangedPrimary = store.addFolder(broad.id, packageRoot);
      expect(unchangedPrimary.primaryPath).toBe(packageRoot);
      expect(unchangedPrimary.folders.find((folder) => folder.path === packageRoot)?.primary).toBe(
        true,
      );
      expect(store.archive(focused.id).archived).toBe(true);
      expect(store.list()).toHaveLength(1);
      expect(store.list(true)).toHaveLength(2);
    } finally {
      store.close();
    }
  });
});
