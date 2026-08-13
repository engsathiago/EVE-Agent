// Matrix tests cover device health plugin behavior.
import { describe, expect, it } from "vitest";
import { isEVEManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects EVE-managed device names", () => {
    expect(isEVEManagedMatrixDevice("EVE Gateway")).toBe(true);
    expect(isEVEManagedMatrixDevice("EVE Debug")).toBe(true);
    expect(isEVEManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isEVEManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale EVE-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "EVE Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "EVE Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "EVE Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary).toEqual({
      currentDeviceId: "du314Zpw3A",
      currentEVEDevices: [
        {
          deviceId: "du314Zpw3A",
          displayName: "EVE Gateway",
          current: true,
        },
      ],
      staleEVEDevices: [
        {
          deviceId: "BritdXC6iL",
          displayName: "EVE Gateway",
          current: false,
        },
        {
          deviceId: "G6NJU9cTgs",
          displayName: "EVE Debug",
          current: false,
        },
      ],
    });
  });
});
