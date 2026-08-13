#!/usr/bin/env -S node --import tsx
// Eve Npm Prepublish Verify script supports EVE repository automation.

import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { formatErrorMessage } from "../src/infra/errors.ts";
import { runNpmVerifyCommand } from "./lib/npm-verify-exec.ts";
import { runInstalledWorkspaceBootstrapSmoke } from "./lib/workspace-bootstrap-smoke.mjs";
import {
  collectInstalledPackageErrors,
  normalizeInstalledBinaryVersion,
  resolveInstalledBinaryCommandInvocation,
} from "./eve-npm-postpublish-verify.ts";
import { resolveNpmCommandInvocation } from "./eve-npm-release-check.ts";

type InstalledPackageJson = {
  version?: string;
};

export type EVENpmPrepublishVerifyArgs =
  | {
      expectedVersion?: string;
      help: false;
      tarballPath: string;
    }
  | {
      expectedVersion?: undefined;
      help: true;
      tarballPath: "";
    };

export function eveNpmPrepublishVerifyUsage(): string {
  return "Usage: node --import tsx scripts/eve-npm-prepublish-verify.ts <tarball.tgz> [expected-version]";
}

export function parseEVENpmPrepublishVerifyArgs(
  argv: readonly string[],
): EVENpmPrepublishVerifyArgs {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  const tarballPath = args[0]?.trim() ?? "";
  if (tarballPath === "--help" || tarballPath === "-h") {
    return { help: true, tarballPath: "" };
  }
  if (!tarballPath) {
    throw new Error(eveNpmPrepublishVerifyUsage());
  }
  if (tarballPath.startsWith("-")) {
    throw new Error(`Unknown eve npm prepublish verifier option: ${tarballPath}`);
  }

  const expectedVersion = args[1]?.trim();
  if (expectedVersion?.startsWith("-")) {
    throw new Error(`Unknown eve npm prepublish verifier option: ${expectedVersion}`);
  }
  const extraArg = args[2]?.trim();
  if (extraArg) {
    throw new Error(`Unexpected eve npm prepublish verifier argument: ${extraArg}`);
  }

  return expectedVersion
    ? { expectedVersion, help: false, tarballPath }
    : { help: false, tarballPath };
}

function npmExec(args: string[], cwd: string): string {
  const invocation = resolveNpmCommandInvocation({
    npmArgs: args,
    npmExecPath: process.env.npm_execpath,
    nodeExecPath: process.execPath,
    platform: process.platform,
  });

  return runNpmVerifyCommand(invocation, cwd);
}

function main(argv = process.argv.slice(2)): void {
  const args = parseEVENpmPrepublishVerifyArgs(argv);
  if (args.help) {
    console.log(eveNpmPrepublishVerifyUsage());
    return;
  }

  const workingDir = mkdtempSync(join(tmpdir(), "eve-prepublish-"));
  const prefixDir = join(workingDir, "prefix");
  try {
    npmExec(
      [
        "install",
        "-g",
        "--prefix",
        prefixDir,
        realpathSync(args.tarballPath),
        "--no-fund",
        "--no-audit",
      ],
      workingDir,
    );
    const globalRoot = npmExec(["root", "-g", "--prefix", prefixDir], workingDir);
    const packageRoot = join(globalRoot, "eve");
    const pkg = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as InstalledPackageJson;
    const resolvedExpectedVersion = args.expectedVersion || pkg.version?.trim() || "";
    const errors = collectInstalledPackageErrors({
      expectedVersion: resolvedExpectedVersion,
      installedVersion: pkg.version?.trim() ?? "",
      packageRoot,
    });
    const binaryInvocation = resolveInstalledBinaryCommandInvocation(prefixDir, ["--version"]);
    const installedBinaryVersion = runNpmVerifyCommand(binaryInvocation, workingDir);
    if (normalizeInstalledBinaryVersion(installedBinaryVersion) !== resolvedExpectedVersion) {
      errors.push(
        `installed eve binary version mismatch: expected ${resolvedExpectedVersion}, found ${installedBinaryVersion || "<missing>"}.`,
      );
    }
    if (errors.length === 0) {
      runInstalledWorkspaceBootstrapSmoke({ packageRoot });
    }
    if (errors.length > 0) {
      throw new Error(`prepared tarball install failed:\n- ${errors.join("\n- ")}`);
    }
    console.log(
      `eve-npm-prepublish-verify: prepared tarball install OK (${resolvedExpectedVersion}).`,
    );
  } finally {
    rmSync(workingDir, { force: true, recursive: true });
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (entrypoint !== null && import.meta.url === entrypoint) {
  try {
    main();
  } catch (error) {
    console.error(`eve-npm-prepublish-verify: ${formatErrorMessage(error)}`);
    process.exitCode = 1;
  }
}
