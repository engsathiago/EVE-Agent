import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";
import type { OperationsDatabase } from "./database.js";
import { openOperationsDatabase } from "./database.js";
import type { ResultStore } from "./result-store.js";
import type { EveStudioArtifact, EveStudioPreviewKind, JsonObject } from "./types.js";

const TEXT_LIMIT = 8 * 1024 * 1024;
const IMPORT_LIMIT = 100 * 1024 * 1024;
// Base64 plus JSON must remain below the Gateway's 25 MiB WebSocket frame cap.
const GATEWAY_TRANSFER_LIMIT = 16 * 1024 * 1024;

type Row = Record<string, unknown>;

const TEMPLATES: Record<string, { filename: string; content: string }> = {
  document: {
    filename: "document.md",
    content: "# New document\n\nCreate, edit, and publish this document with EVE Studio.\n",
  },
  presentation: {
    filename: "presentation.html",
    content:
      '<!doctype html><html lang="en"><meta charset="utf-8"><title>EVE presentation</title><style>body{margin:0;background:#080b16;color:#eef2ff;font:22px system-ui}.slide{min-height:100vh;display:grid;place-content:center;padding:8vw;box-sizing:border-box;border-bottom:1px solid #28304d}h1{font-size:3em;color:#a78bfa}p{max-width:850px;line-height:1.5}</style><section class="slide"><div><h1>New presentation</h1><p>Edit this content in EVE Studio. Each section is a slide.</p></div></section></html>',
  },
  spreadsheet: {
    filename: "spreadsheet.csv",
    content: "Item,Owner,Status,Notes\nFirst task,EVE,Pending,Edit this data\n",
  },
  website: {
    filename: "site.html",
    content:
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EVE site</title><style>body{font-family:system-ui;margin:0;background:#080b16;color:#eef2ff}main{max-width:900px;margin:auto;padding:12vh 24px}h1{font-size:clamp(3rem,10vw,7rem);color:#a78bfa}p{font-size:1.3rem;line-height:1.6}</style><main><h1>EVE</h1><p>This site was created in EVE Studio.</p></main></html>',
  },
  note: { filename: "note.txt", content: "New EVE note.\n" },
  diagram: {
    filename: "diagram.svg",
    content:
      '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#080b16"/><rect x="260" y="190" width="440" height="160" rx="32" fill="#252a44" stroke="#a78bfa" stroke-width="3"/><text x="480" y="270" fill="#eef2ff" text-anchor="middle" font-family="system-ui" font-size="42">EVE</text><text x="480" y="310" fill="#c4b5fd" text-anchor="middle" font-family="system-ui" font-size="20">Edit this SVG diagram</text></svg>',
  },
};

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] : "";
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

function safeFilename(value: string): string {
  const filename = path.basename(value.replaceAll("\0", "")).trim().slice(0, 180);
  if (!filename || filename === "." || filename === "..") {
    throw new Error("invalid filename");
  }
  return filename;
}

function mediaType(filename: string): string {
  const types: Record<string, string> = {
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".html": "text/html",
    ".htm": "text/html",
    ".json": "application/json",
    ".yaml": "application/yaml",
    ".yml": "application/yaml",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return types[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

function editable(filename: string, mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    [".json", ".yaml", ".yml", ".xml", ".svg", ".js", ".ts", ".tsx", ".py"].includes(
      path.extname(filename).toLowerCase(),
    )
  );
}

function previewKind(filename: string, mime: string): EveStudioPreviewKind {
  const extension = path.extname(filename).toLowerCase();
  if ([".html", ".htm"].includes(extension)) {
    return "html";
  }
  if ([".md", ".markdown"].includes(extension)) {
    return "markdown";
  }
  if (extension === ".csv") {
    return "csv";
  }
  if (mime.startsWith("image/") || extension === ".svg") {
    return "image";
  }
  if (mime === "application/pdf") {
    return "pdf";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (editable(filename, mime)) {
    return "text";
  }
  return "download";
}

function digest(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export class StudioStore {
  private readonly ownedDatabase?: OperationsDatabase;
  readonly db: DatabaseSync;
  readonly root: string;

  constructor(
    database?: OperationsDatabase,
    private readonly results?: ResultStore,
    root = path.join(resolveStateDir(), "studio"),
  ) {
    this.ownedDatabase = database ? undefined : openOperationsDatabase();
    this.db = database?.db ?? this.ownedDatabase!.db;
    this.root = root;
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  private row(id: string): Row {
    const row = this.db.prepare("SELECT * FROM studio_artifacts WHERE id=?").get(id) as
      | Row
      | undefined;
    if (!row) {
      throw new Error(`studio artifact not found: ${id}`);
    }
    return row;
  }

  private filePath(row: Row): string {
    const root = path.resolve(this.root, text(row, "id"));
    const target = path.resolve(root, safeFilename(text(row, "filename")));
    if (path.dirname(target) !== root) {
      throw new Error("invalid studio artifact path");
    }
    if (!fs.statSync(target).isFile()) {
      throw new Error(`studio content not found: ${text(row, "id")}`);
    }
    return target;
  }

  private decode(row: Row, includeContent = false): EveStudioArtifact {
    const file = this.filePath(row);
    const stat = fs.statSync(file);
    const mime = text(row, "media_type") || mediaType(file);
    const canEdit = editable(file, mime);
    const item: EveStudioArtifact = {
      id: text(row, "id"),
      title: text(row, "title"),
      filename: text(row, "filename"),
      kind: text(row, "kind"),
      mediaType: mime,
      createdAt: number(row, "created_at"),
      updatedAt: number(row, "updated_at"),
      version: number(row, "version"),
      publishedResultId: text(row, "published_result_id"),
      sizeBytes: stat.size,
      editable: canEdit,
      previewKind: previewKind(file, mime),
    };
    if (includeContent) {
      if (stat.size > GATEWAY_TRANSFER_LIMIT) {
        throw new Error("artifact exceeds the 16 MB Gateway transfer limit");
      }
      if (canEdit && stat.size <= TEXT_LIMIT) {
        item.content = fs.readFileSync(file, "utf8");
      } else {
        item.contentBase64 = fs.readFileSync(file).toString("base64");
      }
      item.versions = (
        this.db
          .prepare(
            `SELECT version,sha256,size_bytes,created_at FROM studio_versions
           WHERE artifact_id=? ORDER BY version DESC`,
          )
          .all(item.id) as Row[]
      ).map((version) => ({
        version: number(version, "version"),
        sha256: text(version, "sha256"),
        sizeBytes: number(version, "size_bytes"),
        createdAt: number(version, "created_at"),
      }));
    }
    return item;
  }

  list(): JsonObject {
    const rows = this.db
      .prepare("SELECT * FROM studio_artifacts ORDER BY updated_at DESC")
      .all() as Row[];
    return {
      artifacts: rows.flatMap((row) => {
        try {
          return [this.decode(row)];
        } catch {
          return [];
        }
      }),
      templates: Object.entries(TEMPLATES).map(([id, template]) => ({
        id,
        filename: template.filename,
        label: id,
      })),
    };
  }

  private insert(input: {
    kind: string;
    title?: string;
    filename: string;
    data: Buffer;
  }): EveStudioArtifact {
    if (input.data.byteLength > IMPORT_LIMIT) {
      throw new Error("artifact exceeds the 100 MB limit");
    }
    const id = `studio_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
    const filename = safeFilename(input.filename);
    const directory = path.join(this.root, id);
    fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
    const target = path.join(directory, filename);
    fs.writeFileSync(target, input.data, { mode: 0o600 });
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO studio_artifacts
         (id,title,filename,kind,media_type,created_at,updated_at,version,published_result_id)
         VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.title?.trim().slice(0, 200) || path.basename(filename, path.extname(filename)),
        filename,
        input.kind,
        mediaType(filename),
        now,
        now,
        1,
        "",
      );
    return this.get(id);
  }

  create(kind: string, options: { title?: string; filename?: string } = {}): EveStudioArtifact {
    const template = TEMPLATES[kind];
    if (!template) {
      throw new Error(`unknown Studio template: ${kind}`);
    }
    return this.insert({
      kind,
      title: options.title,
      filename: options.filename || template.filename,
      data: Buffer.from(template.content),
    });
  }

  import(input: { filename: string; dataBase64: string; title?: string }): EveStudioArtifact {
    const data = Buffer.from(input.dataBase64, "base64");
    if (data.byteLength > GATEWAY_TRANSFER_LIMIT) {
      throw new Error("Studio imports through the Gateway are limited to 16 MB");
    }
    return this.insert({
      kind: "imported",
      title: input.title,
      filename: input.filename,
      data,
    });
  }

  get(id: string, includeContent = false): EveStudioArtifact {
    return this.decode(this.row(id), includeContent);
  }

  save(id: string, input: { content: string; title?: string }): EveStudioArtifact {
    const data = Buffer.from(input.content);
    if (data.byteLength > TEXT_LIMIT) {
      throw new Error("content exceeds the 8 MB editing limit");
    }
    const row = this.row(id);
    const file = this.filePath(row);
    const mime = text(row, "media_type");
    if (!editable(file, mime)) {
      throw new Error("this artifact cannot be edited as text");
    }
    const previous = fs.readFileSync(file);
    let version = number(row, "version");
    if (!previous.equals(data)) {
      const versionRoot = path.join(path.dirname(file), ".versions");
      fs.mkdirSync(versionRoot, { recursive: true, mode: 0o700 });
      const backup = path.join(
        versionRoot,
        `v${version}-${digest(previous).slice(0, 10)}-${path.basename(file)}`,
      );
      if (!fs.existsSync(backup)) {
        fs.writeFileSync(backup, previous, { mode: 0o600 });
      }
      this.db
        .prepare(
          `INSERT OR IGNORE INTO studio_versions
           (artifact_id,version,path,sha256,size_bytes,created_at) VALUES(?,?,?,?,?,?)`,
        )
        .run(id, version, backup, digest(previous), previous.byteLength, Date.now());
      fs.writeFileSync(file, data, { mode: 0o600 });
      version += 1;
    }
    const title = input.title?.trim().slice(0, 200) || text(row, "title");
    this.db
      .prepare("UPDATE studio_artifacts SET title=?,version=?,updated_at=? WHERE id=?")
      .run(title, version, Date.now(), id);
    return this.get(id, true);
  }

  publish(id: string, summary = ""): JsonObject {
    if (!this.results) {
      throw new Error("Result Hub is unavailable");
    }
    const artifact = this.get(id);
    const file = this.filePath(this.row(id));
    let result = this.results.findBySource("studio", id);
    if (!result) {
      result = this.results.create({
        sourceType: "studio",
        sourceId: id,
        title: artifact.title,
        summary: summary || `Published by EVE Studio: ${artifact.filename}`,
        metadata: { studioId: id, version: artifact.version },
        artifacts: [file],
      });
    } else {
      this.results.addArtifact(result.id, file, artifact.filename);
      result = this.results.updateStatus(result.id, "ready", summary);
    }
    this.db
      .prepare("UPDATE studio_artifacts SET published_result_id=?,updated_at=? WHERE id=?")
      .run(result.id, Date.now(), id);
    return { ok: true, artifact: this.get(id), result: this.results.get(result.id) };
  }

  remove(id: string): JsonObject {
    const row = this.row(id);
    const directory = path.dirname(this.filePath(row));
    this.db.prepare("DELETE FROM studio_artifacts WHERE id=?").run(id);
    fs.rmSync(directory, { recursive: true, force: true });
    return { ok: true, id };
  }
}
