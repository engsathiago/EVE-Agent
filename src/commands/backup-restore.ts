// Restores verified EVE backup archives into the current machine's state layout.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import { createBackupArchive } from "../infra/backup-create.js";
import { type RuntimeEnv, writeRuntimeJson } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import {
  resolveBackupPlanFromDisk,
  resolveBackupPlanFromPaths,
  type BackupAssetKind,
} from "./backup-shared.js";
import { backupVerifyCommand } from "./backup-verify.js";

type RestoreManifest = {
  schemaVersion: 1;
  archiveRoot: string;
  paths?: { stateDir?: string; workspaceDirs?: string[] };
  assets: Array<{ kind: BackupAssetKind; sourcePath: string; archivePath: string }>;
};

export type BackupRestoreOptions = {
  archive: string;
  apply?: boolean;
  json?: boolean;
  stateDir?: string;
  configPath?: string;
  oauthDir?: string;
  workspaceRoot?: string;
  preRestoreOutput?: string;
  skipPreRestoreBackup?: boolean;
};

export type BackupRestoreResult = {
  restored: boolean;
  dryRun: boolean;
  archivePath: string;
  archiveRoot: string;
  preRestoreBackup: string | null;
  assets: Array<{
    kind: BackupAssetKind;
    sourcePath: string;
    archivePath: string;
    targetPath: string;
  }>;
  skippedRuntimeFiles: number;
};

const RUNTIME_FILE_NAMES = new Set([
  ".backup.lock",
  "cron.pid",
  "gateway.lock",
  "gateway.pid",
  "gateway_state.json",
  "processes.json",
]);

function isRuntimeFile(file: string): boolean {
  return (
    RUNTIME_FILE_NAMES.has(path.basename(file)) ||
    [".pid", ".sock", ".tmp"].includes(path.extname(file))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseManifest(value: unknown): RestoreManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.archiveRoot !== "string") {
    throw new Error("Backup manifest is invalid after verification.");
  }
  if (!Array.isArray(value.assets)) {
    throw new Error("Backup manifest is missing assets.");
  }
  const assets = value.assets.map((raw) => {
    if (
      !isRecord(raw) ||
      !["state", "config", "credentials", "workspace"].includes(String(raw.kind)) ||
      typeof raw.sourcePath !== "string" ||
      typeof raw.archivePath !== "string"
    ) {
      throw new Error("Backup manifest contains an invalid asset.");
    }
    return {
      kind: raw.kind as BackupAssetKind,
      sourcePath: raw.sourcePath,
      archivePath: raw.archivePath,
    };
  });
  const paths = isRecord(value.paths)
    ? {
        stateDir: typeof value.paths.stateDir === "string" ? value.paths.stateDir : undefined,
        workspaceDirs: Array.isArray(value.paths.workspaceDirs)
          ? value.paths.workspaceDirs.filter((entry): entry is string => typeof entry === "string")
          : undefined,
      }
    : undefined;
  return { schemaVersion: 1, archiveRoot: value.archiveRoot, assets, ...(paths ? { paths } : {}) };
}

function resolveExtractedPath(stagingRoot: string, archivePath: string): string {
  const target = path.resolve(stagingRoot, ...archivePath.split("/"));
  const relative = path.relative(stagingRoot, target);
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`Backup asset resolves outside staging: ${archivePath}`);
  }
  return target;
}

async function currentLayout() {
  const base = await resolveBackupPlanFromDisk({ includeWorkspace: false });
  try {
    const complete = await resolveBackupPlanFromDisk({ includeWorkspace: true });
    return { ...base, workspaceDirs: complete.workspaceDirs };
  } catch {
    return base;
  }
}

function resolveWorkspaceTarget(params: {
  legacyIndex: number;
  assetSourcePath: string;
  manifest: RestoreManifest;
  currentStateDir: string;
  currentWorkspaceDirs: string[];
  workspaceRoot?: string;
}): string {
  if (params.workspaceRoot) {
    return params.legacyIndex === 0
      ? params.workspaceRoot
      : path.join(params.workspaceRoot, path.basename(params.assetSourcePath));
  }
  const sourceWorkspaceDirs = params.manifest.paths?.workspaceDirs ?? [];
  const sourceIndex = sourceWorkspaceDirs.findIndex(
    (entry) => path.resolve(entry) === path.resolve(params.assetSourcePath),
  );
  if (sourceWorkspaceDirs.length > 0 && sourceIndex < 0) {
    throw new Error(
      `Backup workspace asset is not declared in manifest paths: ${params.assetSourcePath}`,
    );
  }
  const configured =
    params.currentWorkspaceDirs[sourceIndex >= 0 ? sourceIndex : params.legacyIndex];
  if (configured) {
    return configured;
  }
  const sourceStateDir = params.manifest.paths?.stateDir;
  if (sourceStateDir) {
    const relative = path.relative(sourceStateDir, params.assetSourcePath);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return path.join(params.currentStateDir, relative);
    }
  }
  return path.join(params.currentStateDir, "workspaces", path.basename(params.assetSourcePath));
}

async function createPreRestoreBackup(params: {
  stateDir: string;
  configPath: string;
  oauthDir: string;
  workspaceDirs: string[];
  output?: string;
}): Promise<string | null> {
  const sourcePaths = {
    stateDir: params.stateDir,
    configPath: params.configPath,
    oauthDir: params.oauthDir,
    workspaceDirs: params.workspaceDirs,
  };
  const plan = await resolveBackupPlanFromPaths({ ...sourcePaths, includeWorkspace: true });
  if (plan.included.length === 0) {
    return null;
  }
  const output = params.output
    ? resolveUserPath(params.output)
    : path.join(
        path.dirname(params.stateDir),
        ".eve-backups",
        `pre-restore-${new Date().toISOString().replaceAll(":", "-")}.tar.gz`,
      );
  const snapshot = await createBackupArchive({
    output,
    includeWorkspace: plan.workspaceDirs.length > 0,
    sourcePaths,
  });
  await backupVerifyCommand(
    { log: () => {}, error: () => {}, exit: () => {} },
    { archive: snapshot.archivePath },
  );
  return snapshot.archivePath;
}

async function assertContainedRelativeSymlinks(root: string): Promise<void> {
  const rootStat = await fs.lstat(root);
  if (rootStat.isSymbolicLink()) {
    throw new Error(`Backup asset root cannot be a symbolic link: ${root}`);
  }
  if (!rootStat.isDirectory()) {
    return;
  }
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const linkTarget = await fs.readlink(entryPath);
        const resolvedTarget = path.resolve(directory, linkTarget);
        const relative = path.relative(root, resolvedTarget);
        const escapesRoot =
          path.isAbsolute(linkTarget) ||
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative);
        if (escapesRoot) {
          throw new Error(`Backup symbolic link resolves outside its asset: ${entryPath}`);
        }
      } else if (entry.isDirectory()) {
        await visit(entryPath);
      }
    }
  };
  await visit(root);
}

async function copyAsset(source: string, target: string, filterRuntime = false): Promise<number> {
  await assertContainedRelativeSymlinks(source);
  const stat = await fs.lstat(source);
  let skipped = 0;
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  if (stat.isDirectory()) {
    await fs.mkdir(target, { recursive: true, mode: 0o700 });
    await fs.cp(source, target, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
      verbatimSymlinks: true,
      filter: (entry) => {
        if (filterRuntime && entry !== source && isRuntimeFile(entry)) {
          skipped += 1;
          return false;
        }
        return true;
      },
    });
  } else if (!isRuntimeFile(source)) {
    await fs.copyFile(source, target);
    await fs.chmod(target, 0o600);
  } else {
    skipped += 1;
  }
  return skipped;
}

async function replaceAsset(
  source: string,
  target: string,
  filterRuntime = false,
): Promise<number> {
  const parent = path.dirname(target);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  const staged = await fs.mkdtemp(path.join(parent, `.${path.basename(target)}.eve-restore-`));
  const stagedTarget = path.join(staged, path.basename(target));
  try {
    if (
      await fs
        .stat(target)
        .then(() => true)
        .catch(() => false)
    ) {
      await fs.cp(target, stagedTarget, { recursive: true, force: true, preserveTimestamps: true });
    }
    const skipped = await copyAsset(source, stagedTarget, filterRuntime);
    await fs.rm(target, { recursive: true, force: true });
    await fs.rename(stagedTarget, target);
    return skipped;
  } finally {
    await fs.rm(staged, { recursive: true, force: true });
  }
}

function formatResult(result: BackupRestoreResult): string {
  const lines = [
    `${result.dryRun ? "Restore plan" : "Backup restored"}: ${result.archivePath}`,
    `Archive root: ${result.archiveRoot}`,
  ];
  for (const asset of result.assets) {
    lines.push(`- ${asset.kind}: ${asset.targetPath}`);
  }
  if (result.preRestoreBackup) {
    lines.push(`Pre-restore backup: ${result.preRestoreBackup}`);
  }
  if (result.skippedRuntimeFiles) {
    lines.push(`Skipped volatile runtime files: ${result.skippedRuntimeFiles}`);
  }
  if (result.dryRun) {
    lines.push("Dry run only; pass --apply to restore these assets.");
  }
  return lines.join("\n");
}

export async function backupRestoreCommand(
  runtime: RuntimeEnv,
  options: BackupRestoreOptions,
): Promise<BackupRestoreResult> {
  const archivePath = resolveUserPath(options.archive);
  const verification = await backupVerifyCommand(
    { ...runtime, log: () => {} },
    { archive: archivePath },
  );
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), "eve-restore-"));
  try {
    await tar.x({ file: archivePath, cwd: stagingRoot, strict: true });
    const manifestPath = path.join(stagingRoot, verification.archiveRoot, "manifest.json");
    const manifest = parseManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")));
    const layout = await currentLayout();
    const stateDir = options.stateDir ? resolveUserPath(options.stateDir) : layout.stateDir;
    const configPath = options.configPath ? resolveUserPath(options.configPath) : layout.configPath;
    const oauthDir = options.oauthDir ? resolveUserPath(options.oauthDir) : layout.oauthDir;
    const workspaceRoot = options.workspaceRoot
      ? resolveUserPath(options.workspaceRoot)
      : undefined;
    let workspaceIndex = 0;
    const assets = manifest.assets.map((asset) => {
      let targetPath: string;
      if (asset.kind === "state") {
        targetPath = stateDir;
      } else if (asset.kind === "config") {
        targetPath = configPath;
      } else if (asset.kind === "credentials") {
        targetPath = oauthDir;
      } else {
        targetPath = resolveWorkspaceTarget({
          legacyIndex: workspaceIndex,
          assetSourcePath: asset.sourcePath,
          manifest,
          currentStateDir: stateDir,
          currentWorkspaceDirs: layout.workspaceDirs,
          workspaceRoot,
        });
        workspaceIndex += 1;
      }
      return { ...asset, targetPath };
    });
    const targetOwners = new Map<string, string>();
    for (const asset of assets) {
      const target = path.resolve(asset.targetPath);
      if (
        target === path.parse(target).root ||
        target === path.resolve(os.homedir()) ||
        target === path.resolve(process.cwd())
      ) {
        throw new Error(`restore target is too broad: ${target}`);
      }
      const existing = targetOwners.get(target);
      if (existing) {
        throw new Error(
          `Backup assets ${existing} and ${asset.archivePath} resolve to the same restore target: ${target}`,
        );
      }
      targetOwners.set(target, asset.archivePath);
    }
    const targets = [...targetOwners.keys()];
    for (let index = 0; index < targets.length; index += 1) {
      for (let other = index + 1; other < targets.length; other += 1) {
        const forward = path.relative(targets[index], targets[other]);
        const reverse = path.relative(targets[other], targets[index]);
        const contains = (relative: string): boolean =>
          relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
        if (contains(forward) || contains(reverse)) {
          throw new Error(`restore targets overlap: ${targets[index]} and ${targets[other]}`);
        }
      }
    }

    let preRestoreBackup: string | null = null;
    let skippedRuntimeFiles = 0;
    if (options.apply) {
      if (!options.skipPreRestoreBackup) {
        preRestoreBackup = await createPreRestoreBackup({
          stateDir,
          configPath,
          oauthDir,
          workspaceDirs: assets
            .filter((asset) => asset.kind === "workspace")
            .map((asset) => asset.targetPath),
          output: options.preRestoreOutput,
        });
      }
      for (const asset of assets) {
        const source = resolveExtractedPath(stagingRoot, asset.archivePath);
        skippedRuntimeFiles += await replaceAsset(source, asset.targetPath, asset.kind === "state");
      }
    }
    const result: BackupRestoreResult = {
      restored: options.apply === true,
      dryRun: options.apply !== true,
      archivePath,
      archiveRoot: manifest.archiveRoot,
      preRestoreBackup,
      assets,
      skippedRuntimeFiles,
    };
    if (options.json) {
      writeRuntimeJson(runtime, result);
    } else {
      runtime.log(formatResult(result));
    }
    return result;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}
