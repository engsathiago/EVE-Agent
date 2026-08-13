// Qa Lab plugin module implements temp dir helper behavior.
import {
  tempWorkspace,
  resolvePreferredEVETmpDir,
  type TempWorkspace,
} from "eve-agent/plugin-sdk/temp-path";

export function createTempDirHarness() {
  const tempDirs: TempWorkspace[] = [];

  return {
    cleanup: async () => {
      await Promise.all(tempDirs.splice(0).map((dir) => dir.cleanup()));
    },
    makeTempDir: async (prefix: string) => {
      const dir = await tempWorkspace({
        rootDir: resolvePreferredEVETmpDir(),
        prefix,
      });
      tempDirs.push(dir);
      return dir.dir;
    },
  };
}
