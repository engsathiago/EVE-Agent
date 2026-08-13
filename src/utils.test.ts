// Tests shared utility helpers used by CLI and runtime modules.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MAX_TIMER_TIMEOUT_MS } from "./shared/number-coercion.js";
import { withTempDir } from "./test-helpers/temp-dir.js";
import { withEnv } from "./test-utils/env.js";
import {
  CONFIG_DIR,
  ensureDir,
  pinConfigDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "eve-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    try {
      const promise = sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps oversized sleep delays before scheduling", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    try {
      const promise = sleep(Number.MAX_SAFE_INTEGER);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), MAX_TIMER_TIMEOUT_MS);

      vi.advanceTimersByTime(MAX_TIMER_TIMEOUT_MS);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.eve when legacy dir is missing", async () => {
    await withTempDir({ prefix: "eve-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".eve");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands EVE_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/eve-home",
      EVE_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/eve-home", "state"));
  });

  it("falls back to the config file directory when only EVE_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/eve-home",
      EVE_CONFIG_PATH: "~/profiles/dev/eve.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/eve-home", "profiles", "dev"));
  });

  it("re-pins the exported configuration root after startup environment selection", () => {
    const originalConfigDir = CONFIG_DIR;
    const selectedConfigDir = path.resolve("/tmp/eve-selected-config-root");
    try {
      expect(
        pinConfigDir({
          EVE_STATE_DIR: selectedConfigDir,
          EVE_TEST_FAST: "1",
        }),
      ).toBe(selectedConfigDir);
      expect(CONFIG_DIR).toBe(selectedConfigDir);
    } finally {
      pinConfigDir({
        EVE_STATE_DIR: originalConfigDir,
        EVE_TEST_FAST: "1",
      });
    }
  });
});

describe("resolveHomeDir", () => {
  it("prefers EVE_HOME over HOME", () => {
    withEnv({ EVE_HOME: "/srv/eve-home", HOME: "/home/other" }, () => {
      expect(resolveHomeDir()).toBe(path.resolve("/srv/eve-home"));
    });
  });
});

describe("shortenHomePath", () => {
  it("uses $EVE_HOME prefix when EVE_HOME is set", () => {
    withEnv({ EVE_HOME: "/srv/eve-home", HOME: "/home/other" }, () => {
      expect(shortenHomePath(`${path.resolve("/srv/eve-home")}/.eve/eve.json`)).toBe(
        "$EVE_HOME/.eve/eve.json",
      );
    });
  });
});

describe("shortenHomeInString", () => {
  it("uses $EVE_HOME replacement when EVE_HOME is set", () => {
    withEnv({ EVE_HOME: "/srv/eve-home", HOME: "/home/other" }, () => {
      expect(
        shortenHomeInString(
          `config: ${path.resolve("/srv/eve-home")}/.eve/eve.json`,
        ),
      ).toBe("config: $EVE_HOME/.eve/eve.json");
    });
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/eve", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "eve"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers EVE_HOME for tilde expansion", () => {
    withEnv({ EVE_HOME: "/srv/eve-home", HOME: "/home/other" }, () => {
      expect(resolveUserPath("~/eve")).toBe(path.resolve("/srv/eve-home", "eve"));
    });
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/eve-home",
      EVE_HOME: "/srv/eve-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/eve", env)).toBe(path.resolve("/srv/eve-home", "eve"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
