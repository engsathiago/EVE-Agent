// Workspace default tests cover environment-variable precedence for the
// built-in agent workspace location.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withEnv } from "../test-utils/env.js";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses EVE_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "eve-home");

    const resolved = withEnv(
      {
        EVE_WORKSPACE_DIR: undefined,
        EVE_PROFILE: undefined,
        EVE_HOME: home,
        HOME: path.join(path.sep, "home", "other"),
      },
      () => resolveDefaultAgentWorkspaceDir(),
    );

    expect(resolved).toBe(path.join(path.resolve(home), ".eve", "workspace"));
  });

  it("uses EVE_WORKSPACE_DIR before EVE_HOME", () => {
    const workspaceDir = path.join(path.sep, "srv", "eve-workspace");

    const resolved = withEnv(
      {
        EVE_WORKSPACE_DIR: workspaceDir,
        EVE_HOME: path.join(path.sep, "srv", "eve-home"),
      },
      () => resolveDefaultAgentWorkspaceDir(),
    );

    expect(resolved).toBe(path.resolve(workspaceDir));
  });
});
