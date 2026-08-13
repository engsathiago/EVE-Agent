// Covers plugin peer linking for development installs.
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditEVEPeerDependenciesInManagedNpmRoot,
  linkEVEPeerDependencies,
  relinkEVEPeerDependenciesInManagedNpmRoot,
} from "./plugin-peer-link.js";
import { cleanupTrackedTempDirs, makeTrackedTempDir } from "./test-helpers/fs-fixtures.js";

const tempDirs: string[] = [];

afterEach(() => {
  cleanupTrackedTempDirs(tempDirs);
});

function makeTempDir() {
  return makeTrackedTempDir("eve-plugin-peer-link", tempDirs);
}

describe("plugin peer links", () => {
  it("relinks eve peers in the managed npm root", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "peer-plugin");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, "package.json"),
      JSON.stringify({
        name: "peer-plugin",
        version: "1.0.0",
        peerDependencies: {
          eve: ">=2026.0.0",
        },
      }),
      "utf8",
    );

    const messages: string[] = [];
    const result = await relinkEVEPeerDependenciesInManagedNpmRoot({
      npmRoot,
      logger: {
        info: (message) => messages.push(message),
        warn: (message) => messages.push(message),
      },
    });

    const linkPath = path.join(packageDir, "node_modules", "eve");
    expect(result).toEqual({ checked: 1, attempted: 1, repaired: 1, skipped: 0 });
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(linkPath)).toBe(fs.realpathSync(process.cwd()));
    expect(messages.join("\n")).toContain('Linked peerDependency "eve"');
  });

  it("audits missing managed npm eve peer links without relinking", async () => {
    const npmRoot = makeTempDir();
    const packageDir = path.join(npmRoot, "node_modules", "peer-plugin");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, "package.json"),
      JSON.stringify({
        name: "peer-plugin",
        version: "1.0.0",
        peerDependencies: {
          eve: ">=2026.0.0",
        },
      }),
      "utf8",
    );

    const result = await auditEVEPeerDependenciesInManagedNpmRoot({ npmRoot });

    const linkPath = path.join(packageDir, "node_modules", "eve");
    expect(result.checked).toBe(1);
    expect(result.broken).toBe(1);
    expect(result.issues[0]?.packageName).toBe("peer-plugin");
    expect(result.issues[0]?.reason).toContain(linkPath);
    expect(fs.existsSync(linkPath)).toBe(false);
  });

  it.runIf(process.platform !== "win32")(
    "does not follow a package-local node_modules symlink while linking eve peers",
    async () => {
      const root = makeTempDir();
      const packageDir = path.join(root, "peer-plugin");
      const outsideDir = path.join(root, "outside-node-modules");
      fs.mkdirSync(packageDir, { recursive: true });
      fs.mkdirSync(outsideDir, { recursive: true });
      fs.symlinkSync(outsideDir, path.join(packageDir, "node_modules"), "dir");

      const warnings: string[] = [];
      const result = await linkEVEPeerDependencies({
        installedDir: packageDir,
        peerDependencies: {
          eve: ">=2026.0.0",
        },
        logger: {
          warn: (message) => warnings.push(message),
        },
      });

      expect(result).toEqual({ repaired: 0, skipped: 1 });
      expect(fs.existsSync(path.join(outsideDir, "eve"))).toBe(false);
      expect(warnings.join("\n")).toContain("is not a real directory");
    },
  );

  it("replaces an existing real eve package directory", async () => {
    const root = makeTempDir();
    const packageDir = path.join(root, "peer-plugin");
    const existingEVEDir = path.join(packageDir, "node_modules", "eve");
    fs.mkdirSync(existingEVEDir, { recursive: true });
    fs.writeFileSync(path.join(existingEVEDir, "package.json"), '{"name":"eve"}', "utf8");

    const messages: string[] = [];
    const result = await linkEVEPeerDependencies({
      installedDir: packageDir,
      peerDependencies: {
        eve: ">=2026.0.0",
      },
      logger: {
        info: (message) => messages.push(message),
      },
    });

    expect(result).toEqual({ repaired: 1, skipped: 0 });
    expect(fs.lstatSync(existingEVEDir).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(existingEVEDir)).toBe(fs.realpathSync(process.cwd()));
    expect(messages.join("\n")).toContain('Linked peerDependency "eve"');
  });

  it("does not delete an unrelated existing package directory", async () => {
    const root = makeTempDir();
    const packageDir = path.join(root, "peer-plugin");
    const existingEVEDir = path.join(packageDir, "node_modules", "eve");
    fs.mkdirSync(existingEVEDir, { recursive: true });
    fs.writeFileSync(
      path.join(existingEVEDir, "package.json"),
      '{"name":"not-eve"}',
      "utf8",
    );

    const warnings: string[] = [];
    const result = await linkEVEPeerDependencies({
      installedDir: packageDir,
      peerDependencies: {
        eve: ">=2026.0.0",
      },
      logger: {
        warn: (message) => warnings.push(message),
      },
    });

    expect(result).toEqual({ repaired: 0, skipped: 1 });
    expect(fs.existsSync(path.join(existingEVEDir, "package.json"))).toBe(true);
    expect(warnings.join("\n")).toContain("already exists and is not a symlink");
  });
});
