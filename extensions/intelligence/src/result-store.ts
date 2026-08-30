import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";
import type { OperationsDatabase } from "./database.js";
import { openOperationsDatabase, parseJsonObject, runTransaction } from "./database.js";
import type { EveResultArtifact, EveResultItem, EveResultStatus, JsonObject } from "./types.js";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] : "";
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

function decodeItem(row: Row): EveResultItem {
  return {
    id: text(row, "id"),
    sourceType: text(row, "source_type"),
    sourceId: text(row, "source_id"),
    title: text(row, "title"),
    summary: text(row, "summary"),
    status: text(row, "status") as EveResultStatus,
    createdAt: number(row, "created_at"),
    updatedAt: number(row, "updated_at"),
    metadata: parseJsonObject(row.metadata_json),
  };
}

function decodeArtifact(row: Row): EveResultArtifact {
  return {
    id: text(row, "id"),
    itemId: text(row, "item_id"),
    name: text(row, "name"),
    path: text(row, "path"),
    mediaType: text(row, "media_type"),
    sizeBytes: number(row, "size_bytes"),
    sha256: text(row, "sha256"),
    version: number(row, "version"),
    createdAt: number(row, "created_at"),
  };
}

function mediaType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  const types: Record<string, string> = {
    ".json": "application/json",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".html": "text/html",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
  };
  return types[extension] ?? "application/octet-stream";
}

function safeArtifactName(value: string): string {
  const name = value.trim();
  if (
    !name ||
    name === "." ||
    name === ".." ||
    path.isAbsolute(name) ||
    path.basename(name) !== name ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error("artifact name must be a single safe filename segment");
  }
  return name;
}

function assertPathWithin(target: string, root: string): void {
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("artifact target resolves outside its result directory");
  }
}

export class ResultStore {
  private readonly ownedDatabase?: OperationsDatabase;
  readonly db: DatabaseSync;

  constructor(
    database?: OperationsDatabase,
    private readonly artifactRoot = path.join(resolveStateDir(), "operations", "results"),
  ) {
    this.ownedDatabase = database ? undefined : openOperationsDatabase();
    this.db = database?.db ?? this.ownedDatabase!.db;
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  create(input: {
    sourceType: string;
    sourceId: string;
    title: string;
    summary?: string;
    status?: EveResultStatus;
    metadata?: JsonObject;
    artifacts?: string[];
  }): EveResultItem {
    const existing = this.findBySource(input.sourceType, input.sourceId);
    if (existing) {
      return existing;
    }
    const id = `result_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO result_items
         (id,source_type,source_id,title,summary,status,created_at,updated_at,metadata_json)
         VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.sourceType,
        input.sourceId,
        input.title,
        input.summary ?? "",
        input.status ?? "ready",
        now,
        now,
        JSON.stringify(input.metadata ?? {}),
      );
    for (const artifact of input.artifacts ?? []) {
      this.addArtifact(id, artifact);
    }
    return this.get(id);
  }

  addArtifact(itemId: string, source: string, name = path.basename(source)): EveResultArtifact {
    this.get(itemId);
    const artifactName = safeArtifactName(name);
    const sourcePath = path.resolve(source);
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile()) {
      throw new Error(`artifact is not a file: ${source}`);
    }
    const current = this.db
      .prepare("SELECT MAX(version) version FROM result_artifacts WHERE item_id=? AND name=?")
      .get(itemId, artifactName) as Row;
    const version = number(current, "version") + 1;
    const id = `artifact_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const itemRoot = path.resolve(this.artifactRoot, itemId);
    const targetDir = path.resolve(itemRoot, artifactName, `v${version}`);
    assertPathWithin(targetDir, itemRoot);
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    const target = path.resolve(targetDir, artifactName);
    assertPathWithin(target, itemRoot);
    fs.copyFileSync(sourcePath, target);
    fs.chmodSync(target, 0o600);
    const digest = createHash("sha256").update(fs.readFileSync(target)).digest("hex");
    this.db
      .prepare(
        `INSERT INTO result_artifacts
         (id,item_id,name,path,media_type,size_bytes,sha256,version,created_at)
         VALUES(?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        itemId,
        artifactName,
        target,
        mediaType(artifactName),
        stat.size,
        digest,
        version,
        Date.now(),
      );
    this.db.prepare("UPDATE result_items SET updated_at=? WHERE id=?").run(Date.now(), itemId);
    return this.get(itemId).artifacts!.find((artifact) => artifact.id === id)!;
  }

  updateStatus(id: string, status: EveResultStatus, note = ""): EveResultItem {
    const item = this.get(id);
    const metadata = note ? { ...item.metadata, lastNote: note } : item.metadata;
    this.db
      .prepare("UPDATE result_items SET status=?,updated_at=?,metadata_json=? WHERE id=?")
      .run(status, Date.now(), JSON.stringify(metadata), id);
    return this.get(id);
  }

  get(id: string): EveResultItem {
    const row = this.db.prepare("SELECT * FROM result_items WHERE id=?").get(id) as Row | undefined;
    if (!row) {
      throw new Error(`result not found: ${id}`);
    }
    const artifacts = this.db
      .prepare("SELECT * FROM result_artifacts WHERE item_id=? ORDER BY name,version")
      .all(id) as Row[];
    return { ...decodeItem(row), artifacts: artifacts.map(decodeArtifact) };
  }

  findBySource(sourceType: string, sourceId: string): EveResultItem | undefined {
    const row = this.db
      .prepare("SELECT id FROM result_items WHERE source_type=? AND source_id=?")
      .get(sourceType, sourceId) as Row | undefined;
    return row ? this.get(text(row, "id")) : undefined;
  }

  list(options: { status?: EveResultStatus; limit?: number } = {}): EveResultItem[] {
    const limit = Math.max(1, Math.min(500, Math.trunc(options.limit ?? 100)));
    const rows = options.status
      ? (this.db
          .prepare("SELECT * FROM result_items WHERE status=? ORDER BY updated_at DESC LIMIT ?")
          .all(options.status, limit) as Row[])
      : (this.db
          .prepare("SELECT * FROM result_items ORDER BY updated_at DESC LIMIT ?")
          .all(limit) as Row[]);
    return rows.map(decodeItem);
  }

  remove(id: string): boolean {
    const item = this.get(id);
    return runTransaction(this.db, () => {
      const result = this.db.prepare("DELETE FROM result_items WHERE id=?").run(id);
      fs.rmSync(path.join(this.artifactRoot, item.id), { recursive: true, force: true });
      return Number(result.changes) > 0;
    });
  }

  status(): JsonObject {
    const rows = this.db
      .prepare("SELECT status,COUNT(*) count FROM result_items GROUP BY status")
      .all() as Row[];
    return {
      counts: Object.fromEntries(rows.map((row) => [text(row, "status"), number(row, "count")])),
      latest: this.list({ limit: 5 }),
    };
  }
}
