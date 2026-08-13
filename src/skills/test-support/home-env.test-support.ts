// Home environment test support isolates HOME-style paths for skill tests.
import os from "node:os";
import { vi } from "vitest";
import { deleteTestEnvValue, setTestEnvValue } from "../../test-utils/env.js";

/** Process home env snapshot used by skill loader tests. */
export type SkillsHomeEnvSnapshot = {
  previousHome: string | undefined;
  previousEVEHome: string | undefined;
  previousUserProfile: string | undefined;
};

export function setMockSkillsHomeEnv(fakeHome: string): SkillsHomeEnvSnapshot {
  const snapshot: SkillsHomeEnvSnapshot = {
    previousHome: process.env.HOME,
    previousEVEHome: process.env.EVE_HOME,
    previousUserProfile: process.env.USERPROFILE,
  };
  setTestEnvValue("HOME", fakeHome);
  deleteTestEnvValue("EVE_HOME");
  deleteTestEnvValue("USERPROFILE");
  vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
  return snapshot;
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    deleteTestEnvValue(key);
  } else {
    setTestEnvValue(key, value);
  }
}

export async function restoreMockSkillsHomeEnv(
  snapshot: SkillsHomeEnvSnapshot,
  cleanup?: () => Promise<void> | void,
) {
  vi.restoreAllMocks();
  restoreEnvValue("HOME", snapshot.previousHome);
  restoreEnvValue("EVE_HOME", snapshot.previousEVEHome);
  restoreEnvValue("USERPROFILE", snapshot.previousUserProfile);
  await cleanup?.();
}
