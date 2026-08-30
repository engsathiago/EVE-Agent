// Control UI controller manages EVE's native project and intelligence product surfaces.
import type { GatewayBrowserClient } from "../gateway.ts";

export type EveProductSection =
  | "projects"
  | "environments"
  | "studio"
  | "integrations"
  | "intelligence";

export type EveProjectFolder = {
  path: string;
  label: string;
  primary: boolean;
  addedAt: number;
};

export type EveProject = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  boardId: string;
  primaryPath: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  folders: EveProjectFolder[];
};

export type EveManagedEnvironment = {
  id: string;
  name: string;
  image: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  ttlMinutes: number;
  cpu: number;
  memoryMb: number;
  persistent: boolean;
  network: boolean;
  workspace: string;
  runtimeError: string;
  expired: boolean;
  snapshots: Array<{ image: string; createdAt: number }>;
};

export type EveStudioArtifact = {
  id: string;
  title: string;
  filename: string;
  kind: string;
  mediaType: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  publishedResultId: string;
  sizeBytes: number;
  editable: boolean;
  previewKind: string;
  content?: string;
  contentBase64?: string;
  versions?: Array<{ version: number; sha256: string; sizeBytes: number; createdAt: number }>;
};

export type EveIntegrationItem = {
  id: string;
  kind: "mcp" | "plugin" | "channel";
  name: string;
  description: string;
  source: string;
  installed: boolean;
  enabled: boolean;
  authType: string;
  requiredEnv: string[];
  version?: string;
};

export type EveSuiteState = {
  loaded: Set<EveProductSection>;
  loading: Set<EveProductSection>;
  busy: boolean;
  error: string | null;
  projects: EveProject[];
  environments: EveManagedEnvironment[];
  studioArtifacts: EveStudioArtifact[];
  studioTemplates: Array<{ id: string; filename: string; label: string }>;
  studioSelected: EveStudioArtifact | null;
  studioDraftTitle: string;
  studioDraftContent: string;
  integrations: EveIntegrationItem[];
  integrationCounts: Record<string, unknown>;
  integrationQuery: string;
  integrationKind: "all" | EveIntegrationItem["kind"];
  intelligence: Record<string, unknown> | null;
  projectDraft: { name: string; description: string; primaryPath: string };
  environmentDraft: {
    name: string;
    image: string;
    ttlMinutes: string;
    cpu: string;
    memoryMb: string;
    persistent: boolean;
    network: boolean;
  };
};

type Host = object;

const states = new WeakMap<Host, EveSuiteState>();

function initialState(): EveSuiteState {
  return {
    loaded: new Set(),
    loading: new Set(),
    busy: false,
    error: null,
    projects: [],
    environments: [],
    studioArtifacts: [],
    studioTemplates: [],
    studioSelected: null,
    studioDraftTitle: "",
    studioDraftContent: "",
    integrations: [],
    integrationCounts: {},
    integrationQuery: "",
    integrationKind: "all",
    intelligence: null,
    projectDraft: { name: "", description: "", primaryPath: "" },
    environmentDraft: {
      name: "",
      image: "",
      ttlMinutes: "120",
      cpu: "1",
      memoryMb: "1024",
      persistent: true,
      network: false,
    },
  };
}

export function getEveSuiteState(host: Host): EveSuiteState {
  const current = states.get(host);
  if (current) {
    return current;
  }
  const next = initialState();
  states.set(host, next);
  return next;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function request(
  client: GatewayBrowserClient | null,
  method: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (!client) {
    throw new Error("Gateway is not connected.");
  }
  return object(await client.request(method, params));
}

export async function loadEveProduct(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  section: EveProductSection;
  force?: boolean;
  requestUpdate?: () => void;
}): Promise<void> {
  const state = getEveSuiteState(params.host);
  if (state.loading.has(params.section) || (!params.force && state.loaded.has(params.section))) {
    return;
  }
  state.loading.add(params.section);
  state.error = null;
  params.requestUpdate?.();
  try {
    if (params.section === "projects") {
      const result = await request(params.client, "projects.list", { includeArchived: true });
      state.projects = array<EveProject>(result.projects);
    } else if (params.section === "environments") {
      const result = await request(params.client, "intelligence.environments.list");
      state.environments = array<EveManagedEnvironment>(result.environments ?? result.items);
    } else if (params.section === "studio") {
      const result = await request(params.client, "intelligence.studio.list");
      state.studioArtifacts = array<EveStudioArtifact>(result.artifacts);
      state.studioTemplates = array(result.templates);
    } else if (params.section === "integrations") {
      const result = await request(params.client, "intelligence.integrations.list");
      state.integrations = array<EveIntegrationItem>(result.items);
      state.integrationCounts = object(result.counts);
    } else {
      state.intelligence = await request(params.client, "intelligence.status");
    }
    state.loaded.add(params.section);
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.loading.delete(params.section);
    params.requestUpdate?.();
  }
}

async function mutate(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  method: string;
  body?: Record<string, unknown>;
  reload: EveProductSection;
  requestUpdate?: () => void;
}): Promise<Record<string, unknown> | null> {
  const state = getEveSuiteState(params.host);
  if (state.busy) {
    return null;
  }
  state.busy = true;
  state.error = null;
  params.requestUpdate?.();
  try {
    const result = await request(params.client, params.method, params.body);
    state.loaded.delete(params.reload);
    await loadEveProduct({ ...params, section: params.reload, force: true });
    return result;
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    return null;
  } finally {
    state.busy = false;
    params.requestUpdate?.();
  }
}

export async function createEveProject(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  requestUpdate?: () => void;
}): Promise<void> {
  const state = getEveSuiteState(params.host);
  const draft = state.projectDraft;
  if (!draft.name.trim()) {
    state.error = "Project name is required.";
    params.requestUpdate?.();
    return;
  }
  const result = await mutate({
    ...params,
    method: "projects.create",
    body: {
      name: draft.name,
      description: draft.description,
      ...(draft.primaryPath
        ? { primaryPath: draft.primaryPath, folders: [draft.primaryPath] }
        : {}),
    },
    reload: "projects",
  });
  if (result) {
    state.projectDraft = { name: "", description: "", primaryPath: "" };
  }
}

export async function archiveEveProject(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  id: string;
  archived: boolean;
  requestUpdate?: () => void;
}): Promise<void> {
  await mutate({
    ...params,
    method: "projects.archive",
    body: { id: params.id, archived: params.archived },
    reload: "projects",
  });
}

export async function createEveEnvironment(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  requestUpdate?: () => void;
}): Promise<void> {
  const state = getEveSuiteState(params.host);
  const draft = state.environmentDraft;
  await mutate({
    ...params,
    method: "intelligence.environments.create",
    body: {
      ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
      ...(draft.image.trim() ? { image: draft.image.trim() } : {}),
      ttlMinutes: Number(draft.ttlMinutes) || 120,
      cpu: Number(draft.cpu) || 1,
      memoryMb: Number(draft.memoryMb) || 1024,
      persistent: draft.persistent,
      network: draft.network,
    },
    reload: "environments",
  });
}

export async function controlEveEnvironment(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  id: string;
  action: "start" | "stop" | "restart" | "snapshot" | "delete";
  requestUpdate?: () => void;
}): Promise<void> {
  const method =
    params.action === "delete"
      ? "intelligence.environments.delete"
      : params.action === "snapshot"
        ? "intelligence.environments.snapshot"
        : "intelligence.environments.control";
  await mutate({
    ...params,
    method,
    body: {
      id: params.id,
      ...(params.action === "start" || params.action === "stop" || params.action === "restart"
        ? { action: params.action }
        : {}),
    },
    reload: "environments",
  });
}

export async function createStudioArtifact(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  kind: string;
  requestUpdate?: () => void;
}): Promise<void> {
  const result = await mutate({
    ...params,
    method: "intelligence.studio.create",
    body: { kind: params.kind },
    reload: "studio",
  });
  const id = typeof result?.id === "string" ? result.id : "";
  if (id) {
    await openStudioArtifact({ ...params, id });
  }
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(reader.error ?? new Error("File read failed.")));
    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) {
        reject(new Error("File could not be encoded for Studio import."));
        return;
      }
      resolve(result.slice(separator + 1));
    });
    reader.readAsDataURL(file);
  });
}

export async function importStudioArtifact(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  file: File;
  requestUpdate?: () => void;
}): Promise<void> {
  const state = getEveSuiteState(params.host);
  if (params.file.size > 16 * 1024 * 1024) {
    state.error = "Studio imports are limited to 16 MB by the Gateway transfer limit.";
    params.requestUpdate?.();
    return;
  }
  let dataBase64: string;
  try {
    dataBase64 = await readFileBase64(params.file);
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    params.requestUpdate?.();
    return;
  }
  const result = await mutate({
    ...params,
    method: "intelligence.studio.import",
    body: { filename: params.file.name, title: params.file.name, dataBase64 },
    reload: "studio",
  });
  const id = typeof result?.id === "string" ? result.id : "";
  if (id) {
    await openStudioArtifact({ ...params, id });
  }
}

export async function openStudioArtifact(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  id: string;
  requestUpdate?: () => void;
}): Promise<void> {
  const state = getEveSuiteState(params.host);
  state.busy = true;
  state.error = null;
  params.requestUpdate?.();
  try {
    const artifact = (await request(params.client, "intelligence.studio.get", {
      id: params.id,
      includeContent: true,
    })) as EveStudioArtifact;
    state.studioSelected = artifact;
    state.studioDraftTitle = artifact.title;
    state.studioDraftContent = artifact.content ?? "";
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.busy = false;
    params.requestUpdate?.();
  }
}

export async function saveStudioArtifact(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  publish?: boolean;
  requestUpdate?: () => void;
}): Promise<void> {
  const state = getEveSuiteState(params.host);
  const selected = state.studioSelected;
  if (!selected) {
    return;
  }
  const saved = await mutate({
    ...params,
    method: "intelligence.studio.save",
    body: { id: selected.id, title: state.studioDraftTitle, content: state.studioDraftContent },
    reload: "studio",
  });
  let persisted = saved;
  if (persisted && params.publish) {
    persisted = await mutate({
      ...params,
      method: "intelligence.studio.publish",
      body: { id: selected.id, summary: `Published from EVE Studio` },
      reload: "studio",
    });
  }
  if (persisted) {
    await openStudioArtifact({ ...params, id: selected.id });
  }
}

export async function deleteStudioArtifact(params: {
  host: Host;
  client: GatewayBrowserClient | null;
  id: string;
  requestUpdate?: () => void;
}): Promise<void> {
  const state = getEveSuiteState(params.host);
  const deleted = await mutate({
    ...params,
    method: "intelligence.studio.delete",
    body: { id: params.id },
    reload: "studio",
  });
  if (deleted && state.studioSelected?.id === params.id) {
    state.studioSelected = null;
    state.studioDraftTitle = "";
    state.studioDraftContent = "";
    params.requestUpdate?.();
  }
}

export function downloadStudioArtifact(artifact: EveStudioArtifact): void {
  const href = artifact.contentBase64
    ? `data:${artifact.mediaType};base64,${artifact.contentBase64}`
    : URL.createObjectURL(new Blob([artifact.content ?? ""], { type: artifact.mediaType }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = artifact.filename;
  anchor.click();
  if (!artifact.contentBase64) {
    URL.revokeObjectURL(href);
  }
}
