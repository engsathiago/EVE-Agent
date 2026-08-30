import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const script = path.resolve(import.meta.dirname, "../scripts/install-vps.sh");

describe("install-vps.sh", () => {
  it("documents the complete VPS install surface", async () => {
    const { stdout } = await execFileAsync("bash", [script, "--help"]);
    expect(stdout).toContain("--source-dir");
    expect(stdout).toContain("--restore");
    expect(stdout).toContain("--gateway-bind");
    expect(stdout).toContain("--gateway-custom-host");
    expect(stdout).toContain("--no-install-daemon");
  });

  it("prints a provider-neutral non-interactive provisioning plan", async () => {
    const { stdout } = await execFileAsync("bash", [
      script,
      "--dry-run",
      "--prefix",
      "/srv/eve/tooling",
      "--gateway-bind",
      "tailnet",
      "--gateway-port",
      "19001",
    ]);
    expect(stdout).toContain("install-cli.sh");
    expect(stdout).toContain("--auth-choice skip");
    expect(stdout).toContain("--install-daemon");
    expect(stdout).toContain("gateway status --probe");
  });

  it("rejects invalid ports before installation", async () => {
    await expect(
      execFileAsync("bash", [script, "--dry-run", "--gateway-port", "70000"]),
    ).rejects.toMatchObject({ stderr: expect.stringContaining("must be 1-65535") });
  });

  it("installs a supplied source checkout as-is without resolving latest", async () => {
    const source = await fs.mkdtemp(path.join(os.tmpdir(), "eve-vps-source-"));
    try {
      await fs.writeFile(path.join(source, "package.json"), '{"name":"eve-agent"}\n');
      const { stdout } = await execFileAsync("bash", [
        script,
        "--dry-run",
        "--skip-onboard",
        "--source-dir",
        source,
      ]);
      expect(stdout).toContain("--no-git-update");
      expect(stdout).not.toContain("--version latest");
    } finally {
      await fs.rm(source, { recursive: true, force: true });
    }
  });

  it("requires and forwards the custom Gateway bind host", async () => {
    await expect(
      execFileAsync("bash", [script, "--dry-run", "--gateway-bind", "custom"]),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining("--gateway-custom-host is required"),
    });
    const { stdout } = await execFileAsync("bash", [
      script,
      "--dry-run",
      "--gateway-bind",
      "custom",
      "--gateway-custom-host",
      "10.0.0.5",
    ]);
    expect(stdout).toContain("--gateway-custom-bind-host 10.0.0.5");
  });
});
