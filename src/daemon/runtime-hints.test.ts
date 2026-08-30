// Daemon runtime hint tests cover platform-specific daemon guidance.
import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          HOME: "/Users/test",
          EVE_STATE_DIR: "/tmp/eve-state",
          EVE_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "eve-gateway",
        windowsTaskName: "EVE Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /Users/test/Library/Logs/eve/gateway.log",
      "Launchd stderr (if installed): suppressed",
      "Restart attempts: /tmp/eve-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          EVE_STATE_DIR: "/tmp/eve-state",
        },
        systemdServiceName: "eve-gateway",
        windowsTaskName: "EVE Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u eve-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/eve-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          EVE_STATE_DIR: "/tmp/eve-state",
        },
        systemdServiceName: "eve-gateway",
        windowsTaskName: "EVE Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "EVE Gateway" /V /FO LIST',
      "Restart attempts: /tmp/eve-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "eve gateway install",
        startCommand: "eve gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.eve.gateway.plist",
        systemdServiceName: "eve-gateway",
        windowsTaskName: "EVE Gateway",
      }),
    ).toEqual([
      "eve gateway install",
      "eve gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.eve.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "eve gateway install",
        startCommand: "eve gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.eve.gateway.plist",
        systemdServiceName: "eve-gateway",
        windowsTaskName: "EVE Gateway",
      }),
    ).toEqual(["eve gateway install", "eve gateway", "systemctl --user start eve-gateway.service"]);
  });
});
