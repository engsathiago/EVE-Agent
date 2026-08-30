import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { configureSqliteConnectionPragmas } from "eve-agent/plugin-sdk/plugin-state-runtime";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";

type Row = Record<string, unknown>;

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

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] : "";
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error("invalid project slug");
  }
  return slug;
}

function normalizeFolder(value: string): string {
  const resolved = path.resolve(value);
  const stat = fs.statSync(resolved, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) {
    throw new Error(`project folder does not exist: ${resolved}`);
  }
  return resolved;
}

function isInside(target: string, root: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

export class ProjectStore {
  readonly db: DatabaseSync;
  private readonly maintenance: ReturnType<typeof configureSqliteConnectionPragmas>;

  constructor(dbPath = path.join(resolveStateDir(), "workboard", "projects.sqlite")) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
    if (!fs.existsSync(dbPath)) {
      fs.closeSync(fs.openSync(dbPath, "a", 0o600));
    }
    this.db = new DatabaseSync(dbPath);
    this.maintenance = configureSqliteConnectionPragmas(this.db, {
      busyTimeoutMs: 15_000,
      checkpointIntervalMs: 0,
      databaseLabel: "EVE projects database",
      databasePath: dbPath,
      foreignKeys: true,
      synchronous: "NORMAL",
    });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        board_id TEXT NOT NULL DEFAULT '',
        primary_path TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS project_folders (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        is_primary INTEGER NOT NULL DEFAULT 0,
        added_at INTEGER NOT NULL,
        PRIMARY KEY(project_id,path)
      );
      CREATE INDEX IF NOT EXISTS project_folders_path_idx ON project_folders(path);
    `);
    try {
      fs.chmodSync(dbPath, 0o600);
    } catch {}
  }

  close(): void {
    this.maintenance.close();
    this.db.close();
  }

  private folders(id: string): EveProjectFolder[] {
    return (
      this.db
        .prepare(
          `SELECT path,label,is_primary,added_at FROM project_folders
         WHERE project_id=? ORDER BY is_primary DESC,added_at`,
        )
        .all(id) as Row[]
    ).map((row) => ({
      path: text(row, "path"),
      label: text(row, "label"),
      primary: number(row, "is_primary") !== 0,
      addedAt: number(row, "added_at"),
    }));
  }

  private decode(row: Row): EveProject {
    return {
      id: text(row, "id"),
      slug: text(row, "slug"),
      name: text(row, "name"),
      description: text(row, "description"),
      icon: text(row, "icon"),
      color: text(row, "color"),
      boardId: text(row, "board_id"),
      primaryPath: text(row, "primary_path"),
      createdAt: number(row, "created_at"),
      updatedAt: number(row, "updated_at"),
      archived: number(row, "archived") !== 0,
      folders: this.folders(text(row, "id")),
    };
  }

  get(idOrSlug: string): EveProject {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id=? OR slug=?")
      .get(idOrSlug, idOrSlug) as Row | undefined;
    if (!row) {
      throw new Error(`project not found: ${idOrSlug}`);
    }
    return this.decode(row);
  }

  list(includeArchived = false): EveProject[] {
    const rows = (
      includeArchived
        ? this.db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all()
        : this.db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY updated_at DESC").all()
    ) as Row[];
    return rows.map((row) => this.decode(row));
  }

  create(input: {
    name: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
    boardId?: string;
    folders?: string[];
    primaryPath?: string;
  }): EveProject {
    const name = input.name.trim();
    if (!name) {
      throw new Error("project name is required");
    }
    const slug = slugify(input.slug || name);
    const id = `project_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const normalized = [...new Set((input.folders ?? []).map(normalizeFolder))];
    const primaryPath = input.primaryPath
      ? normalizeFolder(input.primaryPath)
      : normalized[0] || "";
    if (primaryPath && !normalized.includes(primaryPath)) {
      normalized.unshift(primaryPath);
    }
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO projects
           (id,slug,name,description,icon,color,board_id,primary_path,created_at,updated_at,archived)
           VALUES(?,?,?,?,?,?,?,?,?,?,0)`,
        )
        .run(
          id,
          slug,
          name,
          input.description?.trim() || "",
          input.icon?.trim() || "",
          input.color?.trim() || "",
          input.boardId?.trim() || slug,
          primaryPath,
          now,
          now,
        );
      for (const folder of normalized) {
        this.db
          .prepare(
            `INSERT INTO project_folders(project_id,path,label,is_primary,added_at)
             VALUES(?,?,?,?,?)`,
          )
          .run(id, folder, path.basename(folder), folder === primaryPath ? 1 : 0, now);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.get(id);
  }

  update(
    idOrSlug: string,
    patch: { name?: string; description?: string; icon?: string; color?: string; boardId?: string },
  ): EveProject {
    const project = this.get(idOrSlug);
    this.db
      .prepare(
        `UPDATE projects SET name=?,description=?,icon=?,color=?,board_id=?,updated_at=? WHERE id=?`,
      )
      .run(
        patch.name?.trim() || project.name,
        patch.description ?? project.description,
        patch.icon ?? project.icon,
        patch.color ?? project.color,
        patch.boardId?.trim() || project.boardId,
        Date.now(),
        project.id,
      );
    return this.get(project.id);
  }

  addFolder(
    idOrSlug: string,
    folder: string,
    options: { label?: string; primary?: boolean } = {},
  ): EveProject {
    const project = this.get(idOrSlug);
    const normalized = normalizeFolder(folder);
    const now = Date.now();
    const makePrimary = options.primary === true || !project.primaryPath;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (makePrimary) {
        this.db
          .prepare("UPDATE project_folders SET is_primary=0 WHERE project_id=?")
          .run(project.id);
      }
      this.db
        .prepare(
          `INSERT INTO project_folders(project_id,path,label,is_primary,added_at)
           VALUES(?,?,?,?,?)
           ON CONFLICT(project_id,path) DO UPDATE SET
           label=excluded.label,
           is_primary=CASE
             WHEN excluded.is_primary=1 THEN 1
             ELSE project_folders.is_primary
           END`,
        )
        .run(
          project.id,
          normalized,
          options.label?.trim() || path.basename(normalized),
          makePrimary ? 1 : 0,
          now,
        );
      this.db
        .prepare("UPDATE projects SET primary_path=?,updated_at=? WHERE id=?")
        .run(makePrimary ? normalized : project.primaryPath, now, project.id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return this.get(project.id);
  }

  removeFolder(idOrSlug: string, folder: string): EveProject {
    const project = this.get(idOrSlug);
    const normalized = path.resolve(folder);
    this.db
      .prepare("DELETE FROM project_folders WHERE project_id=? AND path=?")
      .run(project.id, normalized);
    const remaining = this.folders(project.id);
    const primaryPath = remaining.find((item) => item.primary)?.path || remaining[0]?.path || "";
    this.db
      .prepare("UPDATE project_folders SET is_primary=(path=?) WHERE project_id=?")
      .run(primaryPath, project.id);
    this.db
      .prepare("UPDATE projects SET primary_path=?,updated_at=? WHERE id=?")
      .run(primaryPath, Date.now(), project.id);
    return this.get(project.id);
  }

  archive(idOrSlug: string, archived = true): EveProject {
    const project = this.get(idOrSlug);
    this.db
      .prepare("UPDATE projects SET archived=?,updated_at=? WHERE id=?")
      .run(archived ? 1 : 0, Date.now(), project.id);
    return this.get(project.id);
  }

  remove(idOrSlug: string): { ok: true; id: string } {
    const project = this.get(idOrSlug);
    this.db.prepare("DELETE FROM projects WHERE id=?").run(project.id);
    return { ok: true, id: project.id };
  }

  match(target: string): EveProject | undefined {
    const resolved = path.resolve(target);
    const longestMatch = (project: EveProject): number =>
      Math.max(
        ...project.folders
          .filter((folder) => isInside(resolved, folder.path))
          .map((folder) => folder.path.length),
      );
    return this.list()
      .filter((project) => project.folders.some((folder) => isInside(resolved, folder.path)))
      .toSorted((left, right) => longestMatch(right) - longestMatch(left))[0];
  }
}
