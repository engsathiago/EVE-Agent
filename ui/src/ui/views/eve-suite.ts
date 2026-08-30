// Control UI views render EVE Projects, Environments, Studio, Integrations, and Intelligence.
import { html, nothing, type TemplateResult } from "lit";
import {
  archiveEveProject,
  controlEveEnvironment,
  createEveEnvironment,
  createEveProject,
  createStudioArtifact,
  deleteStudioArtifact,
  downloadStudioArtifact,
  getEveSuiteState,
  importStudioArtifact,
  loadEveProduct,
  openStudioArtifact,
  saveStudioArtifact,
  type EveIntegrationItem,
  type EveProductSection,
  type EveStudioArtifact,
} from "../controllers/eve-suite.ts";
import type { GatewayBrowserClient } from "../gateway.ts";
import { pathForTab } from "../navigation.ts";

type Props = {
  host: object;
  basePath?: string;
  client: GatewayBrowserClient | null;
  connected: boolean;
  canWrite?: boolean;
  onRequestUpdate?: () => void;
};

function requestUpdate(props: Props): void {
  props.onRequestUpdate?.();
}

function ensureLoaded(props: Props, section: EveProductSection): void {
  if (props.connected) {
    void loadEveProduct({
      host: props.host,
      client: props.client,
      section,
      requestUpdate: props.onRequestUpdate,
    });
  }
}

function renderShell(
  props: Props,
  section: EveProductSection,
  title: string,
  subtitle: string,
  content: TemplateResult,
): TemplateResult {
  const state = getEveSuiteState(props.host);
  ensureLoaded(props, section);
  return html`
    <section class="eve-suite" data-eve-page=${section}>
      <header class="eve-suite__hero">
        <div>
          <div class="eve-suite__eyebrow">EVE native workspace</div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <button
          class="btn"
          type="button"
          ?disabled=${!props.connected || state.loading.has(section)}
          @click=${() =>
            void loadEveProduct({
              host: props.host,
              client: props.client,
              section,
              force: true,
              requestUpdate: props.onRequestUpdate,
            })}
        >
          ${state.loading.has(section) ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      ${!props.connected
        ? html`<div class="callout">Connect to the Gateway to use this workspace.</div>`
        : nothing}
      ${state.error ? html`<div class="callout danger" role="alert">${state.error}</div>` : nothing}
      ${content}
    </section>
  `;
}

function field(
  label: string,
  value: string,
  onInput: (value: string) => void,
  options: { placeholder?: string; type?: string } = {},
): TemplateResult {
  return html`
    <label class="eve-suite__field">
      <span>${label}</span>
      <input
        .value=${value}
        type=${options.type ?? "text"}
        placeholder=${options.placeholder ?? ""}
        @input=${(event: Event) => onInput((event.currentTarget as HTMLInputElement).value)}
      />
    </label>
  `;
}

function formatDate(value: number): string {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "—";
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function renderProjects(props: Props): TemplateResult {
  const state = getEveSuiteState(props.host);
  const writable = props.canWrite !== false && props.connected && !state.busy;
  const updateDraft = (patch: Partial<typeof state.projectDraft>) => {
    state.projectDraft = { ...state.projectDraft, ...patch };
    requestUpdate(props);
  };
  const content = html`
    <div class="eve-suite__layout eve-suite__layout--aside">
      <form
        class="card eve-suite__form"
        @submit=${(event: SubmitEvent) => {
          event.preventDefault();
          void createEveProject({
            host: props.host,
            client: props.client,
            requestUpdate: props.onRequestUpdate,
          });
        }}
      >
        <div class="card-title">New project</div>
        <div class="card-sub">
          Group folders, sessions and a Mission Control board under one identity.
        </div>
        ${field("Name", state.projectDraft.name, (name) => updateDraft({ name }), {
          placeholder: "Launch campaign",
        })}
        <label class="eve-suite__field">
          <span>Description</span>
          <textarea
            .value=${state.projectDraft.description}
            placeholder="What this project is responsible for"
            @input=${(event: Event) =>
              updateDraft({ description: (event.currentTarget as HTMLTextAreaElement).value })}
          ></textarea>
        </label>
        ${field(
          "Primary folder",
          state.projectDraft.primaryPath,
          (primaryPath) => updateDraft({ primaryPath }),
          { placeholder: "/srv/eve/project" },
        )}
        <button class="btn primary" type="submit" ?disabled=${!writable}>Create project</button>
      </form>
      <div class="eve-suite__stack" data-testid="projects-list">
        ${state.projects.length
          ? state.projects.map(
              (project) => html`
                <article class="card eve-suite__item ${project.archived ? "is-muted" : ""}">
                  <div class="eve-suite__item-head">
                    <div>
                      <div class="card-title">${project.icon || "◈"} ${project.name}</div>
                      <div class="card-sub">
                        ${project.description || `Project ${project.slug}`}
                      </div>
                    </div>
                    <span class="eve-suite__badge"
                      >${project.archived ? "archived" : "active"}</span
                    >
                  </div>
                  <dl class="eve-suite__facts">
                    <div>
                      <dt>Board</dt>
                      <dd>${project.boardId}</dd>
                    </div>
                    <div>
                      <dt>Folders</dt>
                      <dd>${project.folders.length}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>${formatDate(project.updatedAt)}</dd>
                    </div>
                  </dl>
                  ${project.folders.length
                    ? html`<div class="eve-suite__paths">
                        ${project.folders.map(
                          (folder) =>
                            html`<code>${folder.primary ? "★ " : ""}${folder.path}</code>`,
                        )}
                      </div>`
                    : nothing}
                  <div class="eve-suite__actions">
                    <button
                      class="btn"
                      type="button"
                      ?disabled=${!writable}
                      @click=${() =>
                        void archiveEveProject({
                          host: props.host,
                          client: props.client,
                          id: project.id,
                          archived: !project.archived,
                          requestUpdate: props.onRequestUpdate,
                        })}
                    >
                      ${project.archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                </article>
              `,
            )
          : html`<div class="card eve-suite__empty">
              No projects yet. Create the first EVE workspace.
            </div>`}
      </div>
    </div>
  `;
  return renderShell(
    props,
    "projects",
    "Projects",
    "Persistent multi-folder workspaces connected to their own boards and agent activity.",
    content,
  );
}

export function renderEnvironments(props: Props): TemplateResult {
  const state = getEveSuiteState(props.host);
  const writable = props.canWrite !== false && props.connected && !state.busy;
  const updateDraft = (patch: Partial<typeof state.environmentDraft>) => {
    state.environmentDraft = { ...state.environmentDraft, ...patch };
    requestUpdate(props);
  };
  const content = html`
    <form
      class="card eve-suite__form eve-suite__form--wide"
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        void createEveEnvironment({
          host: props.host,
          client: props.client,
          requestUpdate: props.onRequestUpdate,
        });
      }}
    >
      <div class="card-title">Create isolated environment</div>
      <div class="eve-suite__form-grid">
        ${field("Name", state.environmentDraft.name, (name) => updateDraft({ name }), {
          placeholder: "research-sandbox",
        })}
        ${field("Docker image", state.environmentDraft.image, (image) => updateDraft({ image }), {
          placeholder: "ubuntu:24.04",
        })}
        ${field(
          "TTL (minutes)",
          state.environmentDraft.ttlMinutes,
          (ttlMinutes) => updateDraft({ ttlMinutes }),
          { type: "number" },
        )}
        ${field("CPU", state.environmentDraft.cpu, (cpu) => updateDraft({ cpu }), {
          type: "number",
        })}
        ${field(
          "Memory (MB)",
          state.environmentDraft.memoryMb,
          (memoryMb) => updateDraft({ memoryMb }),
          { type: "number" },
        )}
      </div>
      <div class="eve-suite__checks">
        <label
          ><input
            type="checkbox"
            .checked=${state.environmentDraft.persistent}
            @change=${(event: Event) =>
              updateDraft({ persistent: (event.currentTarget as HTMLInputElement).checked })}
          />
          Persistent workspace</label
        >
        <label
          ><input
            type="checkbox"
            .checked=${state.environmentDraft.network}
            @change=${(event: Event) =>
              updateDraft({ network: (event.currentTarget as HTMLInputElement).checked })}
          />
          Network access</label
        >
      </div>
      <button class="btn primary" type="submit" ?disabled=${!writable}>Create environment</button>
    </form>
    <div class="eve-suite__grid" data-testid="environments-list">
      ${state.environments.length
        ? state.environments.map(
            (environment) => html`
              <article class="card eve-suite__item">
                <div class="eve-suite__item-head">
                  <div>
                    <div class="card-title">${environment.name}</div>
                    <div class="card-sub">${environment.image}</div>
                  </div>
                  <span class="eve-suite__badge is-${environment.status}"
                    >${environment.status}</span
                  >
                </div>
                <dl class="eve-suite__facts">
                  <div>
                    <dt>Quota</dt>
                    <dd>${environment.cpu} CPU · ${environment.memoryMb} MB</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>${formatDate(environment.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>Snapshots</dt>
                    <dd>${environment.snapshots.length}</dd>
                  </div>
                </dl>
                <code class="eve-suite__path">${environment.workspace}</code>
                ${environment.runtimeError
                  ? html`<div class="callout danger">${environment.runtimeError}</div>`
                  : nothing}
                <div class="eve-suite__actions">
                  ${(["start", "stop", "restart", "snapshot", "delete"] as const).map(
                    (action) => html`<button
                      class="btn ${action === "delete" ? "danger" : ""}"
                      type="button"
                      ?disabled=${!writable}
                      @click=${() =>
                        void controlEveEnvironment({
                          host: props.host,
                          client: props.client,
                          id: environment.id,
                          action,
                          requestUpdate: props.onRequestUpdate,
                        })}
                    >
                      ${action}
                    </button>`,
                  )}
                </div>
              </article>
            `,
          )
        : html`<div class="card eve-suite__empty">No managed environments are running.</div>`}
    </div>
  `;
  return renderShell(
    props,
    "environments",
    "Environments",
    "Create disposable or persistent Docker workspaces with explicit resource and lifetime limits.",
    content,
  );
}

function studioPreview(artifact: EveStudioArtifact, content: string): TemplateResult {
  if (artifact.previewKind === "html") {
    return html`<iframe class="eve-suite__preview-frame" sandbox="" .srcdoc=${content}></iframe>`;
  }
  if (artifact.previewKind === "image" && content.trim().startsWith("<svg")) {
    return html`<iframe class="eve-suite__preview-frame" sandbox="" .srcdoc=${content}></iframe>`;
  }
  const dataUrl = artifact.contentBase64
    ? `data:${artifact.mediaType};base64,${artifact.contentBase64}`
    : "";
  if (artifact.previewKind === "image" && dataUrl) {
    return html`<img class="eve-suite__preview-media" src=${dataUrl} alt=${artifact.title} />`;
  }
  if (artifact.previewKind === "audio" && dataUrl) {
    return html`<audio class="eve-suite__preview-player" controls src=${dataUrl}></audio>`;
  }
  if (artifact.previewKind === "video" && dataUrl) {
    return html`<video class="eve-suite__preview-media" controls src=${dataUrl}></video>`;
  }
  if (artifact.previewKind === "pdf" && dataUrl) {
    return html`<iframe
      class="eve-suite__preview-frame"
      title=${artifact.title}
      src=${dataUrl}
    ></iframe>`;
  }
  if (!artifact.editable) {
    return html`<div class="eve-suite__empty eve-suite__empty--large">
      Preview is unavailable for this file. Use Download to open the original artifact.
    </div>`;
  }
  return html`<pre class="eve-suite__preview-text">${content}</pre>`;
}

export function renderStudio(props: Props): TemplateResult {
  const state = getEveSuiteState(props.host);
  const writable = props.canWrite !== false && props.connected && !state.busy;
  const selected = state.studioSelected;
  const content = html`
    <div class="eve-suite__template-row">
      ${state.studioTemplates.map(
        (template) => html`<button
          class="btn"
          type="button"
          ?disabled=${!writable}
          @click=${() =>
            void createStudioArtifact({
              host: props.host,
              client: props.client,
              kind: template.id,
              requestUpdate: props.onRequestUpdate,
            })}
        >
          New ${template.label}
        </button>`,
      )}
      <label class="btn ${!writable ? "disabled" : ""}">
        Import file
        <input
          class="eve-suite__file-input"
          type="file"
          ?disabled=${!writable}
          @change=${(event: Event) => {
            const input = event.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            input.value = "";
            if (file) {
              void importStudioArtifact({
                host: props.host,
                client: props.client,
                file,
                requestUpdate: props.onRequestUpdate,
              });
            }
          }}
        />
      </label>
    </div>
    <div class="eve-suite__studio">
      <aside class="card eve-suite__artifact-list" data-testid="studio-artifacts">
        <div class="card-title">Artifacts</div>
        ${state.studioArtifacts.length
          ? state.studioArtifacts.map(
              (artifact) => html`<button
                class="eve-suite__artifact ${selected?.id === artifact.id ? "is-selected" : ""}"
                type="button"
                @click=${() =>
                  void openStudioArtifact({
                    host: props.host,
                    client: props.client,
                    id: artifact.id,
                    requestUpdate: props.onRequestUpdate,
                  })}
              >
                <strong>${artifact.title}</strong
                ><span
                  >${artifact.filename} · v${artifact.version} ·
                  ${formatBytes(artifact.sizeBytes)}</span
                >
              </button>`,
            )
          : html`<div class="eve-suite__empty">
              Create a document, deck, sheet, site, note or diagram.
            </div>`}
      </aside>
      <div class="card eve-suite__editor">
        ${selected
          ? html`
              <div class="eve-suite__editor-head">
                <input
                  class="eve-suite__title-input"
                  .value=${state.studioDraftTitle}
                  @input=${(event: Event) => {
                    state.studioDraftTitle = (event.currentTarget as HTMLInputElement).value;
                    requestUpdate(props);
                  }}
                />
                <span class="eve-suite__badge">${selected.previewKind}</span>
              </div>
              <div
                class="eve-suite__editor-grid ${selected.editable
                  ? ""
                  : "eve-suite__editor-grid--preview-only"}"
              >
                ${selected.editable
                  ? html`<textarea
                      class="eve-suite__code"
                      .value=${state.studioDraftContent}
                      @input=${(event: Event) => {
                        state.studioDraftContent = (
                          event.currentTarget as HTMLTextAreaElement
                        ).value;
                        requestUpdate(props);
                      }}
                    ></textarea>`
                  : nothing}
                <div class="eve-suite__preview">
                  ${studioPreview(selected, state.studioDraftContent)}
                </div>
              </div>
              ${selected.versions?.length
                ? html`<div class="eve-suite__versions">
                    ${selected.versions.map(
                      (version) => html`<span
                        >v${version.version} · ${formatBytes(version.sizeBytes)} ·
                        ${formatDate(version.createdAt)}</span
                      >`,
                    )}
                  </div>`
                : nothing}
              <div class="eve-suite__actions">
                <button
                  class="btn"
                  type="button"
                  ?disabled=${!writable || !selected.editable}
                  @click=${() =>
                    void saveStudioArtifact({
                      host: props.host,
                      client: props.client,
                      requestUpdate: props.onRequestUpdate,
                    })}
                >
                  Save version
                </button>
                <button
                  class="btn primary"
                  type="button"
                  ?disabled=${!writable || !selected.editable}
                  @click=${() =>
                    void saveStudioArtifact({
                      host: props.host,
                      client: props.client,
                      publish: true,
                      requestUpdate: props.onRequestUpdate,
                    })}
                >
                  Save & publish
                </button>
                ${selected.publishedResultId
                  ? html`<span class="eve-suite__published"
                      >Published to Result Hub · ${selected.publishedResultId}</span
                    >`
                  : nothing}
                <button class="btn" type="button" @click=${() => downloadStudioArtifact(selected)}>
                  Download
                </button>
                <button
                  class="btn danger"
                  type="button"
                  ?disabled=${!writable}
                  @click=${() =>
                    void deleteStudioArtifact({
                      host: props.host,
                      client: props.client,
                      id: selected.id,
                      requestUpdate: props.onRequestUpdate,
                    })}
                >
                  Delete
                </button>
              </div>
            `
          : html`<div class="eve-suite__empty eve-suite__empty--large">
              Select an artifact to edit and preview it.
            </div>`}
      </div>
    </div>
  `;
  return renderShell(
    props,
    "studio",
    "Studio",
    "A versioned workspace for documents, presentations, spreadsheets, websites and media artifacts.",
    content,
  );
}

function integrationGroup(
  items: EveIntegrationItem[],
  kind: EveIntegrationItem["kind"],
  basePath: string,
): TemplateResult {
  const matches = items.filter((item) => item.kind === kind);
  return html`
    <section class="eve-suite__integration-group">
      <h2>${kind === "mcp" ? "MCP servers" : kind === "plugin" ? "Plugins" : "Channels"}</h2>
      <div class="eve-suite__grid">
        ${matches.map(
          (item) => html`<article class="card eve-suite__item">
            <div class="eve-suite__item-head">
              <div>
                <div class="card-title">${item.name}</div>
                <div class="card-sub">${item.description}</div>
              </div>
              <span class="eve-suite__badge ${item.enabled ? "is-running" : ""}"
                >${item.enabled ? "enabled" : item.installed ? "installed" : "available"}</span
              >
            </div>
            <dl class="eve-suite__facts">
              <div>
                <dt>Source</dt>
                <dd>
                  ${item.source.startsWith("https://")
                    ? html`<a href=${item.source} target="_blank" rel="noreferrer"
                        >${item.source}</a
                      >`
                    : item.source}
                </dd>
              </div>
              <div>
                <dt>Auth</dt>
                <dd>${item.authType}</dd>
              </div>
              ${item.version
                ? html`<div>
                    <dt>Version</dt>
                    <dd>${item.version}</dd>
                  </div>`
                : nothing}
            </dl>
            ${item.requiredEnv.length
              ? html`<div class="eve-suite__paths">
                  ${item.requiredEnv.map((name) => html`<code>${name}</code>`)}
                </div>`
              : nothing}
            <div class="eve-suite__actions">
              <a
                class="btn"
                href=${pathForTab(
                  kind === "mcp" ? "mcp" : kind === "plugin" ? "config" : "channels",
                  basePath,
                )}
                >${item.installed ? "Manage" : "Install"}</a
              >
            </div>
          </article>`,
        )}
      </div>
    </section>
  `;
}

export function renderIntegrations(props: Props): TemplateResult {
  const state = getEveSuiteState(props.host);
  const counts = state.integrationCounts as {
    total?: number;
    installed?: number;
    enabled?: number;
    byKind?: Record<string, number>;
  };
  const query = state.integrationQuery.trim().toLocaleLowerCase();
  const filtered = state.integrations.filter((item) => {
    const matchesKind = state.integrationKind === "all" || item.kind === state.integrationKind;
    const searchText = `${item.name} ${item.description} ${item.source}`.toLocaleLowerCase();
    return matchesKind && searchText.includes(query);
  });
  const content = html`
    <div class="eve-suite__metrics">
      ${[
        ["Catalog", counts.total ?? 0],
        ["Installed", counts.installed ?? 0],
        ["Enabled", counts.enabled ?? 0],
      ].map(
        ([label, value]) =>
          html`<div class="card eve-suite__metric">
            <span>${label}</span><strong>${value}</strong>
          </div>`,
      )}
    </div>
    <div class="card eve-suite__integration-toolbar">
      <label class="eve-suite__field">
        <span>Search catalog</span>
        <input
          type="search"
          placeholder="Search integrations"
          .value=${state.integrationQuery}
          @input=${(event: Event) => {
            state.integrationQuery = (event.currentTarget as HTMLInputElement).value;
            requestUpdate(props);
          }}
        />
      </label>
      <div class="eve-suite__filter-row" role="group" aria-label="Integration type">
        ${(["all", "plugin", "channel", "mcp"] as const).map(
          (kind) => html`<button
            class="btn ${state.integrationKind === kind ? "primary" : ""}"
            type="button"
            aria-pressed=${state.integrationKind === kind}
            @click=${() => {
              state.integrationKind = kind;
              requestUpdate(props);
            }}
          >
            ${kind === "all" ? "All" : kind === "mcp" ? "MCP" : `${kind}s`}
          </button>`,
        )}
      </div>
    </div>
    ${filtered.length
      ? (["plugin", "channel", "mcp"] as const)
          .filter((kind) => filtered.some((item) => item.kind === kind))
          .map((kind) => integrationGroup(filtered, kind, props.basePath ?? ""))
      : html`<div class="card eve-suite__empty">No integrations match this filter.</div>`}
  `;
  return renderShell(
    props,
    "integrations",
    "Integration Store",
    "One credential-safe catalog for EVE plugins, communication channels and MCP servers.",
    content,
  );
}

function countOf(value: unknown, key: string): number {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const direct = row[key];
  if (typeof direct === "number") {
    return direct;
  }
  for (const candidate of [
    "items",
    "runs",
    "jobs",
    "nodes",
    "experiments",
    "artifacts",
    "traces",
  ]) {
    if (Array.isArray(row[candidate])) {
      return row[candidate].length;
    }
  }
  return 0;
}

function intelligenceCard(label: string, value: unknown, accent: string): TemplateResult {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const total = countOf(value, "total") || countOf(value, "count");
  return html`<article
    class="card eve-suite__intelligence-card"
    style=${`--eve-card-accent:${accent}`}
  >
    <div class="eve-suite__item-head">
      <div class="card-title">${label}</div>
      <span class="eve-suite__metric-number">${total}</span>
    </div>
    <div class="eve-suite__mini-facts">
      ${Object.entries(row)
        .slice(0, 5)
        .map(([key, entry]) => {
          const display =
            typeof entry === "number" || typeof entry === "string" || typeof entry === "boolean"
              ? String(entry)
              : Array.isArray(entry)
                ? `${entry.length} items`
                : "ready";
          return html`<span><b>${key}</b>${display}</span>`;
        })}
    </div>
  </article>`;
}

export function renderIntelligence(props: Props): TemplateResult {
  const state = getEveSuiteState(props.host);
  const status = state.intelligence ?? {};
  const surfaces: Array<[string, string, string]> = [
    ["traces", "Observability", "#7c3aed"],
    ["results", "Result Hub", "#06b6d4"],
    ["flows", "Durable Flows", "#2563eb"],
    ["evals", "Evaluations", "#f59e0b"],
    ["router", "Adaptive Router", "#ec4899"],
    ["experiments", "Canary Lab", "#8b5cf6"],
    ["workers", "Remote Workers", "#10b981"],
    ["modelLab", "Model Lab", "#f43f5e"],
    ["packages", "Work Packages", "#14b8a6"],
  ];
  const content = html`
    <div class="eve-suite__metrics">
      <div class="card eve-suite__metric">
        <span>Runtime</span
        ><strong>${state.loaded.has("intelligence") ? "Ready" : "Loading"}</strong>
      </div>
      <div class="card eve-suite__metric">
        <span>Subsystems</span><strong>${surfaces.length}</strong>
      </div>
      <div class="card eve-suite__metric"><span>Policy layer</span><strong>EVE-owned</strong></div>
    </div>
    <div class="eve-suite__intelligence-grid" data-testid="intelligence-grid">
      ${surfaces.map(([key, label, accent]) => intelligenceCard(label, status[key], accent))}
    </div>
    <div class="card eve-suite__architecture">
      <div class="card-title">Operational intelligence loop</div>
      <div class="eve-suite__flowline">
        <span>Trace</span><i>→</i><span>Evaluate</span><i>→</i><span>Route</span><i>→</i
        ><span>Experiment</span><i>→</i><span>Promote</span><i>→</i><span>Rollback</span>
      </div>
      <p>
        Every subsystem persists through the Gateway and is also available through the EVE CLI and
        agent tools.
      </p>
    </div>
  `;
  return renderShell(
    props,
    "intelligence",
    "Intelligence",
    "Observability, durable execution, evaluation, routing, experiments, workers and Model Lab in one native plane.",
    content,
  );
}
