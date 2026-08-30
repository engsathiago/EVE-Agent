import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import { backupRestoreCommand } from "./backup-restore.js";
import * as backupShared from "./backup-shared.js";
import { buildBackupArchivePath } from "./backup-shared.js";

const cleanup: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of cleanup.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

function runtime(): RuntimeEnv {
  return { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
}

async function fixture(stateLinkTarget?: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "eve-backup-restore-"));
  cleanup.push(root);
  const archiveRoot = "2026-08-20T12-00-00.000Z-eve-backup";
  const staging = path.join(root, "archive");
  const archivePath = path.join(root, "backup.tar.gz");
  const sources = {
    state: "/old/.eve",
    config: "/old/eve.json",
    credentials: "/old/credentials",
    workspace: "/old/workspace",
  };
  const assets = (Object.entries(sources) as Array<[keyof typeof sources, string]>).map(
    ([kind, sourcePath]) => ({
      kind,
      sourcePath,
      archivePath: buildBackupArchivePath(archiveRoot, sourcePath),
    }),
  );
  await fs.mkdir(path.join(staging, archiveRoot), { recursive: true });
  await fs.writeFile(
    path.join(staging, archiveRoot, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      createdAt: "2026-08-20T12:00:00.000Z",
      archiveRoot,
      runtimeVersion: "test",
      platform: process.platform,
      nodeVersion: process.version,
      paths: { stateDir: sources.state, workspaceDirs: [sources.workspace] },
      assets,
    })}\n`,
  );
  for (const asset of assets) {
    const target = path.join(staging, ...asset.archivePath.split("/"));
    if (asset.kind === "config") {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, '{"name":"restored"}\n');
    } else {
      await fs.mkdir(target, { recursive: true });
      await fs.writeFile(path.join(target, `${asset.kind}.txt`), `${asset.kind}\n`);
      if (asset.kind === "state") {
        await fs.writeFile(path.join(target, "gateway.pid"), "999\n");
        if (stateLinkTarget) {
          await fs.symlink(stateLinkTarget, path.join(target, "state-link.txt"));
        }
      }
    }
  }
  await tar.c({ file: archivePath, gzip: true, cwd: staging }, [archiveRoot]);
  return { root, archivePath };
}

describe("backup restore", () => {
  it("defaults to a verified dry-run and relocates assets without writing", async () => {
    const { root, archivePath } = await fixture();
    const targets = {
      stateDir: path.join(root, "target-state"),
      configPath: path.join(root, "target-config.json"),
      oauthDir: path.join(root, "target-oauth"),
      workspaceRoot: path.join(root, "target-workspace"),
    };
    vi.spyOn(backupShared, "resolveBackupPlanFromDisk").mockResolvedValue({
      ...targets,
      workspaceDirs: [targets.workspaceRoot],
      included: [],
      skipped: [],
    });
    const result = await backupRestoreCommand(runtime(), { archive: archivePath, ...targets });
    expect(result).toMatchObject({ restored: false, dryRun: true, preRestoreBackup: null });
    expect(result.assets.map((asset) => asset.targetPath)).toEqual([
      targets.stateDir,
      targets.configPath,
      targets.oauthDir,
      targets.workspaceRoot,
    ]);
    await expect(fs.stat(targets.stateDir)).rejects.toThrow();
  });

  it("applies an overlay and excludes source-machine runtime markers", async () => {
    const { root, archivePath } = await fixture();
    const targets = {
      stateDir: path.join(root, "target-state"),
      configPath: path.join(root, "target-config.json"),
      oauthDir: path.join(root, "target-oauth"),
      workspaceRoot: path.join(root, "target-workspace"),
    };
    vi.spyOn(backupShared, "resolveBackupPlanFromDisk").mockResolvedValue({
      ...targets,
      workspaceDirs: [targets.workspaceRoot],
      included: [],
      skipped: [],
    });
    await fs.mkdir(targets.stateDir, { recursive: true });
    await fs.writeFile(path.join(targets.stateDir, "preserved.txt"), "keep\n");

    const result = await backupRestoreCommand(runtime(), {
      archive: archivePath,
      ...targets,
      apply: true,
      skipPreRestoreBackup: true,
    });
    expect(result).toMatchObject({ restored: true, dryRun: false, skippedRuntimeFiles: 1 });
    expect(await fs.readFile(path.join(targets.stateDir, "state.txt"), "utf8")).toBe("state\n");
    expect(await fs.readFile(path.join(targets.stateDir, "preserved.txt"), "utf8")).toBe("keep\n");
    expect(await fs.readFile(targets.configPath, "utf8")).toContain("restored");
    expect(await fs.readFile(path.join(targets.oauthDir, "credentials.txt"), "utf8")).toBe(
      "credentials\n",
    );
    expect(await fs.readFile(path.join(targets.workspaceRoot, "workspace.txt"), "utf8")).toBe(
      "workspace\n",
    );
    await expect(fs.stat(path.join(targets.stateDir, "gateway.pid"))).rejects.toThrow();
  });

  it.skipIf(process.platform === "win32")(
    "preserves contained relative symbolic links after removing restore staging",
    async () => {
      const { root, archivePath } = await fixture("state.txt");
      const stateDir = path.join(root, "target-state");
      vi.spyOn(backupShared, "resolveBackupPlanFromDisk").mockResolvedValue({
        stateDir,
        configPath: path.join(root, "target-config.json"),
        oauthDir: path.join(root, "target-oauth"),
        workspaceDirs: [path.join(root, "target-workspace")],
        included: [],
        skipped: [],
      });

      await backupRestoreCommand(runtime(), {
        archive: archivePath,
        stateDir,
        apply: true,
        skipPreRestoreBackup: true,
      });

      const restoredLink = path.join(stateDir, "state-link.txt");
      expect(await fs.readlink(restoredLink)).toBe("state.txt");
      expect(await fs.readFile(restoredLink, "utf8")).toBe("state\n");
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects symbolic links that escape the restored asset",
    async () => {
      const { root, archivePath } = await fixture("../outside.txt");
      const stateDir = path.join(root, "target-state");
      vi.spyOn(backupShared, "resolveBackupPlanFromDisk").mockResolvedValue({
        stateDir,
        configPath: path.join(root, "target-config.json"),
        oauthDir: path.join(root, "target-oauth"),
        workspaceDirs: [path.join(root, "target-workspace")],
        included: [],
        skipped: [],
      });

      await expect(
        backupRestoreCommand(runtime(), {
          archive: archivePath,
          stateDir,
          apply: true,
          skipPreRestoreBackup: true,
        }),
      ).rejects.toThrow(/symbolic link resolves outside/);
    },
  );

  it("backs up the resolved custom destinations before overwriting them", async () => {
    const { root, archivePath } = await fixture();
    const targets = {
      stateDir: path.join(root, "custom-state"),
      configPath: path.join(root, "custom-config.json"),
      oauthDir: path.join(root, "custom-oauth"),
      workspaceRoot: path.join(root, "custom-workspace"),
    };
    await fs.mkdir(targets.stateDir, { recursive: true });
    await fs.mkdir(targets.oauthDir, { recursive: true });
    await fs.mkdir(targets.workspaceRoot, { recursive: true });
    await fs.writeFile(path.join(targets.stateDir, "before.txt"), "old state\n");
    await fs.writeFile(targets.configPath, '{"name":"old"}\n');
    await fs.writeFile(path.join(targets.oauthDir, "before.txt"), "old oauth\n");
    await fs.writeFile(path.join(targets.workspaceRoot, "before.txt"), "old workspace\n");
    vi.spyOn(backupShared, "resolveBackupPlanFromDisk").mockResolvedValue({
      stateDir: path.join(root, "unrelated-state"),
      configPath: path.join(root, "unrelated-config.json"),
      oauthDir: path.join(root, "unrelated-oauth"),
      workspaceDirs: [],
      included: [],
      skipped: [],
    });
    const preRestoreOutput = path.join(root, "pre-restore.tar.gz");

    const result = await backupRestoreCommand(runtime(), {
      archive: archivePath,
      ...targets,
      preRestoreOutput,
      apply: true,
    });
    expect(result.preRestoreBackup).toBe(preRestoreOutput);

    const extracted = path.join(root, "pre-restore-extracted");
    await fs.mkdir(extracted);
    await tar.x({ file: preRestoreOutput, cwd: extracted, strict: true });
    const roots = await fs.readdir(extracted);
    const manifest = JSON.parse(
      await fs.readFile(path.join(extracted, roots[0], "manifest.json"), "utf8"),
    ) as {
      assets: Array<{ kind: string; sourcePath: string; archivePath: string }>;
    };
    const canonicalTargets = await Promise.all([
      fs.realpath(targets.stateDir),
      fs.realpath(targets.configPath),
      fs.realpath(targets.oauthDir),
      fs.realpath(targets.workspaceRoot),
    ]);
    expect(manifest.assets.map((asset) => asset.sourcePath).toSorted()).toEqual(
      canonicalTargets.toSorted(),
    );
    const configAsset = manifest.assets.find((asset) => asset.kind === "config")!;
    expect(
      await fs.readFile(path.join(extracted, ...configAsset.archivePath.split("/")), "utf8"),
    ).toContain('"name":"old"');
  });

  it("maps workspace assets by manifest identity when an earlier workspace was covered", async () => {
    const { root, archivePath } = await fixture();
    const rewriteRoot = path.join(root, "rewrite");
    await fs.mkdir(rewriteRoot);
    await tar.x({ file: archivePath, cwd: rewriteRoot, strict: true });
    const [archiveRoot] = await fs.readdir(rewriteRoot);
    const manifestPath = path.join(rewriteRoot, archiveRoot, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
      paths: { stateDir: string; workspaceDirs: string[] };
    };
    manifest.paths.workspaceDirs = ["/old/.eve/workspaces/covered", "/old/workspace"];
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await fs.rm(archivePath);
    await tar.c({ file: archivePath, gzip: true, cwd: rewriteRoot }, [archiveRoot]);

    const firstWorkspace = path.join(root, "current-first");
    const secondWorkspace = path.join(root, "current-second");
    vi.spyOn(backupShared, "resolveBackupPlanFromDisk").mockResolvedValue({
      stateDir: path.join(root, "state"),
      configPath: path.join(root, "config.json"),
      oauthDir: path.join(root, "oauth"),
      workspaceDirs: [firstWorkspace, secondWorkspace],
      included: [],
      skipped: [],
    });

    const result = await backupRestoreCommand(runtime(), { archive: archivePath });
    expect(result.assets.find((asset) => asset.kind === "workspace")?.targetPath).toBe(
      secondWorkspace,
    );
  });
});
