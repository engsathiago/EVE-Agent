// Proxy capture env tests cover environment variable generation for capture sessions.
import { describe, expect, it } from "vitest";
import {
  applyDebugProxyEnv,
  EVE_DEBUG_PROXY_ENABLED,
  EVE_DEBUG_PROXY_SESSION_ID,
  resolveDebugProxySettings,
} from "./env.js";

describe("resolveDebugProxySettings", () => {
  it("keeps an implicit debug proxy session id stable within one process", () => {
    const env = {
      [EVE_DEBUG_PROXY_ENABLED]: "1",
    } satisfies NodeJS.ProcessEnv;

    const first = resolveDebugProxySettings(env);
    const second = resolveDebugProxySettings(env);

    expect(first.sessionId).toBe(second.sessionId);
  });

  it("prefers an explicit session id from the environment", () => {
    const settings = resolveDebugProxySettings({
      [EVE_DEBUG_PROXY_ENABLED]: "1",
      [EVE_DEBUG_PROXY_SESSION_ID]: "session-explicit",
    });

    expect(settings.sessionId).toBe("session-explicit");
  });

  it("retains deprecated capture storage settings for Plugin SDK compatibility", () => {
    const settings = resolveDebugProxySettings({
      EVE_DEBUG_PROXY_DB_PATH: "/tmp/legacy-capture.sqlite",
      EVE_DEBUG_PROXY_BLOB_DIR: "/tmp/legacy-capture-blobs",
    });

    expect(settings.dbPath).toBe("/tmp/legacy-capture.sqlite");
    expect(settings.blobDir).toBe("/tmp/legacy-capture-blobs");
  });

  it("does not pass obsolete capture storage overrides to child processes", () => {
    const env = applyDebugProxyEnv(
      {
        EVE_DEBUG_PROXY_DB_PATH: "/tmp/legacy-capture.sqlite",
        EVE_DEBUG_PROXY_BLOB_DIR: "/tmp/legacy-capture-blobs",
      },
      {
        proxyUrl: "http://127.0.0.1:7799",
        sessionId: "session-child",
      },
    );

    expect(env.EVE_DEBUG_PROXY_DB_PATH).toBeUndefined();
    expect(env.EVE_DEBUG_PROXY_BLOB_DIR).toBeUndefined();
  });
});
