// Matrix plugin module implements device health behavior.
export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleEVEDevices: MatrixManagedDeviceInfo[];
  currentEVEDevices: MatrixManagedDeviceInfo[];
};

const EVE_DEVICE_NAME_PREFIX = "EVE ";

export function isEVEManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(EVE_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const eveDevices = devices.filter((device) => isEVEManagedMatrixDevice(device.displayName));
  return {
    currentDeviceId,
    staleEVEDevices: eveDevices.filter((device) => !device.current),
    currentEVEDevices: eveDevices.filter((device) => device.current),
  };
}
