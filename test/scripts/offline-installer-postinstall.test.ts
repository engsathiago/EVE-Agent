import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("offline installer package lifecycle", () => {
  it("runs EVE's audited postinstall in the final staged package before promotion", () => {
    const script = readFileSync("scripts/install-offline.sh", "utf8");
    const install = script.indexOf("npm install");
    const postinstall = script.indexOf('node "$eve_postinstall"');
    const promote = script.indexOf('mv "$stage_dir" "$install_dir"');

    expect(install).toBeGreaterThanOrEqual(0);
    expect(postinstall).toBeGreaterThan(install);
    expect(promote).toBeGreaterThan(postinstall);
    expect(script).toContain('eve_package_root="$stage_dir/app/node_modules/eve-agent"');
    expect(script).toContain('if [[ ! -f "$eve_postinstall" ]]');
  });
});
