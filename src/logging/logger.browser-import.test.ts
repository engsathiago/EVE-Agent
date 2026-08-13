// Logger browser import tests cover safe import behavior in browser-like runtimes.
import { importFreshModule } from "eve-agent/plugin-sdk/test-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredEVETmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredEVETmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredEVETmpDir =
    params?.resolvePreferredEVETmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredEVETmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-eve-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-eve-dir.js")>(
      "../infra/tmp-eve-dir.js",
    );
    return {
      ...actual,
      resolvePreferredEVETmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredEVETmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-eve-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredEVETmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredEVETmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/eve");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/eve/eve.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredEVETmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toStrictEqual({
      level: "silent",
      file: "/tmp/eve/eve.log",
      maxFileBytes: 100 * 1024 * 1024,
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(module.getLogger().info("browser-safe")).toBeUndefined();
    expect(resolvePreferredEVETmpDir).not.toHaveBeenCalled();
  });
});
