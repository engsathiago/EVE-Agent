// Launchd current service tests cover resolving active macOS service labels.
import { describe, expect, it } from "vitest";
import { isCurrentProcessLaunchdServiceLabel } from "./launchd-current-service.js";

describe("isCurrentProcessLaunchdServiceLabel", () => {
  it("matches launchd-provided service labels", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.eve.gateway", {
        LAUNCH_JOB_LABEL: "ai.eve.gateway",
      }),
    ).toBe(true);
  });

  it("falls back to EVE service markers when XPC_SERVICE_NAME is inherited", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.eve.gateway", {
        XPC_SERVICE_NAME: "0",
        EVE_SERVICE_MARKER: "eve",
        EVE_SERVICE_KIND: "gateway",
        EVE_LAUNCHD_LABEL: "ai.eve.gateway",
      }),
    ).toBe(true);
  });

  it("preserves label-only fallback when launchd exposes no label variables", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.eve.gateway", {
        EVE_LAUNCHD_LABEL: "ai.eve.gateway",
      }),
    ).toBe(true);
  });

  it("can require service markers for label-only fallback", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel(
        "ai.eve.gateway",
        {
          EVE_LAUNCHD_LABEL: "ai.eve.gateway",
        },
        { allowConfiguredLabelFallback: false },
      ),
    ).toBe(false);
  });

  it("does not treat unrelated inherited launchd labels as current services", () => {
    expect(
      isCurrentProcessLaunchdServiceLabel("ai.eve.gateway", {
        XPC_SERVICE_NAME: "0",
        EVE_LAUNCHD_LABEL: "ai.eve.gateway",
      }),
    ).toBe(false);
  });
});
