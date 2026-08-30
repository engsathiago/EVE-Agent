// Install download test utilities provide isolated state and workspace paths.
import { createEVETestState, type EVETestState } from "../../test-utils/eve-test-state.js";

/** Creates isolated EVE state for install download tests. */
export async function createInstallDownloadTestState(): Promise<EVETestState> {
  return await createEVETestState({
    layout: "state-only",
    prefix: "eve-skills-install-",
  });
}
