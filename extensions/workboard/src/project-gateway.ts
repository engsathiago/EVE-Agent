import { formatErrorMessage } from "eve-agent/plugin-sdk/error-runtime";
import type { EVEPluginApi } from "../api.js";
import type { ProjectStore } from "./project-store.js";

type Context = Parameters<Parameters<EVEPluginApi["registerGatewayMethod"]>[1]>[0];

function respondError(respond: Context["respond"], error: unknown): void {
  respond(false, undefined, { code: "projects_error", message: formatErrorMessage(error) });
}

function required(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

export function registerProjectGatewayMethods(api: EVEPluginApi, projects: ProjectStore): void {
  const register = (
    name: string,
    scope: "operator.read" | "operator.write",
    handler: (params: Record<string, unknown>) => unknown,
  ) => {
    api.registerGatewayMethod(
      name,
      async ({ params, respond }) => {
        try {
          respond(true, await handler(params));
        } catch (error) {
          respondError(respond, error);
        }
      },
      { scope },
    );
  };
  register("projects.list", "operator.read", (params) => ({
    projects: projects.list(params.includeArchived === true),
  }));
  register("projects.get", "operator.read", (params) => projects.get(required(params, "id")));
  register("projects.match", "operator.read", (params) => ({
    project: projects.match(required(params, "path")) ?? null,
  }));
  register("projects.create", "operator.write", (params) =>
    projects.create({
      name: required(params, "name"),
      slug: typeof params.slug === "string" ? params.slug : undefined,
      description: typeof params.description === "string" ? params.description : undefined,
      icon: typeof params.icon === "string" ? params.icon : undefined,
      color: typeof params.color === "string" ? params.color : undefined,
      boardId: typeof params.boardId === "string" ? params.boardId : undefined,
      primaryPath: typeof params.primaryPath === "string" ? params.primaryPath : undefined,
      folders: Array.isArray(params.folders)
        ? params.folders.filter((entry): entry is string => typeof entry === "string")
        : [],
    }),
  );
  register("projects.update", "operator.write", (params) =>
    projects.update(required(params, "id"), {
      name: typeof params.name === "string" ? params.name : undefined,
      description: typeof params.description === "string" ? params.description : undefined,
      icon: typeof params.icon === "string" ? params.icon : undefined,
      color: typeof params.color === "string" ? params.color : undefined,
      boardId: typeof params.boardId === "string" ? params.boardId : undefined,
    }),
  );
  register("projects.folder.add", "operator.write", (params) =>
    projects.addFolder(required(params, "id"), required(params, "path"), {
      label: typeof params.label === "string" ? params.label : undefined,
      primary: params.primary === true,
    }),
  );
  register("projects.folder.remove", "operator.write", (params) =>
    projects.removeFolder(required(params, "id"), required(params, "path")),
  );
  register("projects.archive", "operator.write", (params) =>
    projects.archive(required(params, "id"), params.archived !== false),
  );
  register("projects.delete", "operator.write", (params) =>
    projects.remove(required(params, "id")),
  );
}
