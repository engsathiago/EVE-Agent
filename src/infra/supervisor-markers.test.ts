// Covers supervisor marker files used to identify managed EVE processes.
import { describe, expect, it } from "vitest";
import { detectRespawnSupervisor, SUPERVISOR_HINT_ENV_VARS } from "./supervisor-markers.js";

describe("SUPERVISOR_HINT_ENV_VARS", () => {
  it("includes the cross-platform supervisor hint env vars", () => {
    const envVars = new Set(SUPERVISOR_HINT_ENV_VARS);
    expect(envVars.has("LAUNCH_JOB_LABEL")).toBe(true);
    expect(envVars.has("INVOCATION_ID")).toBe(true);
    expect(envVars.has("EVE_WINDOWS_TASK_NAME")).toBe(true);
    expect(envVars.has("EVE_SERVICE_MARKER")).toBe(true);
    expect(envVars.has("EVE_SERVICE_KIND")).toBe(true);
  });
});

describe("detectRespawnSupervisor", () => {
  it("detects launchd from EVE's explicit marker or current gateway launchd job", () => {
    expect(detectRespawnSupervisor({ EVE_LAUNCHD_LABEL: " ai.eve.gateway " }, "darwin")).toBe(
      "launchd",
    );
    expect(detectRespawnSupervisor({ EVE_LAUNCHD_LABEL: "   " }, "darwin")).toBeNull();
    expect(detectRespawnSupervisor({ LAUNCH_JOB_LABEL: "ai.eve.gateway" }, "darwin")).toBe(
      "launchd",
    );
    expect(
      detectRespawnSupervisor({ LAUNCH_JOB_NAME: "ai.eve.work", EVE_PROFILE: "work" }, "darwin"),
    ).toBe("launchd");
    expect(detectRespawnSupervisor({ LAUNCH_JOB_LABEL: "ai.eve.mac" }, "darwin")).toBeNull();
    expect(detectRespawnSupervisor({ XPC_SERVICE_NAME: "ai.eve.mac" }, "darwin")).toBeNull();
    expect(
      detectRespawnSupervisor({ XPC_SERVICE_NAME: "ai.eve.mac", EVE_PROFILE: "mac" }, "darwin"),
    ).toBeNull();
    expect(detectRespawnSupervisor({ XPC_SERVICE_NAME: "ai.eve.gateway" }, "darwin")).toBe(
      "launchd",
    );
  });

  it("detects systemd only from non-blank platform-specific hints", () => {
    expect(detectRespawnSupervisor({ INVOCATION_ID: "abc123" }, "linux")).toBe("systemd");
    expect(detectRespawnSupervisor({ JOURNAL_STREAM: "" }, "linux")).toBeNull();
  });

  it("detects Linux EVE gateway service markers only for opt-in callers", () => {
    const gatewayServiceEnv = {
      EVE_SERVICE_MARKER: " eve ",
      EVE_SERVICE_KIND: " gateway ",
    };
    expect(detectRespawnSupervisor(gatewayServiceEnv, "linux")).toBeNull();
    expect(
      detectRespawnSupervisor(gatewayServiceEnv, "linux", {
        includeLinuxEVEGatewayServiceMarker: true,
      }),
    ).toBe("systemd");
    expect(
      detectRespawnSupervisor(
        {
          EVE_SERVICE_MARKER: "eve",
          EVE_SERVICE_KIND: "worker",
        },
        "linux",
        { includeLinuxEVEGatewayServiceMarker: true },
      ),
    ).toBeNull();
    expect(
      detectRespawnSupervisor(
        {
          EVE_SERVICE_MARKER: "other",
          EVE_SERVICE_KIND: "gateway",
        },
        "linux",
        { includeLinuxEVEGatewayServiceMarker: true },
      ),
    ).toBeNull();
  });

  it("detects scheduled-task supervision on Windows from either hint family", () => {
    expect(detectRespawnSupervisor({ EVE_WINDOWS_TASK_NAME: "EVE Gateway" }, "win32")).toBe(
      "schtasks",
    );
    expect(
      detectRespawnSupervisor(
        {
          EVE_SERVICE_MARKER: "eve",
          EVE_SERVICE_KIND: "gateway",
        },
        "win32",
      ),
    ).toBe("schtasks");
    expect(
      detectRespawnSupervisor(
        {
          EVE_SERVICE_MARKER: "eve",
          EVE_SERVICE_KIND: "worker",
        },
        "win32",
      ),
    ).toBeNull();
  });

  it("ignores service markers on non-Windows platforms and unknown platforms", () => {
    expect(
      detectRespawnSupervisor(
        {
          EVE_SERVICE_MARKER: "eve",
          EVE_SERVICE_KIND: "gateway",
        },
        "linux",
      ),
    ).toBeNull();
    expect(detectRespawnSupervisor({ LAUNCH_JOB_LABEL: "ai.eve.gateway" }, "freebsd")).toBeNull();
  });
});
