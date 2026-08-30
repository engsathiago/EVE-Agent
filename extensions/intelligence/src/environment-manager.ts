import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";
import type { OperationsDatabase } from "./database.js";
import { openOperationsDatabase } from "./database.js";
import type { EveEnvironmentSnapshot, EveManagedEnvironment, JsonObject } from "./types.js";

const execFileAsync = promisify(execFile);
const DEFAULT_IMAGE = "nikolaik/python-nodejs:python3.11-nodejs20";
const ACTIVE_STATUSES = new Set(["creating", "running", "paused"]);

type Row = Record<string, unknown>;

export type EnvironmentLimits = {
  maxRunning: number;
  maxTotalCpu: number;
  maxTotalMemoryMb: number;
};

export type DockerRunResult = { stdout: string; stderr?: string };
export type DockerRunner = (args: string[], timeoutMs: number) => Promise<DockerRunResult>;

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] : "";
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

function boolean(row: Row, key: string): boolean {
  return number(row, key) !== 0;
}

function snapshots(value: unknown): EveEnvironmentSnapshot[] {
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is EveEnvironmentSnapshot =>
          Boolean(
            entry &&
            typeof entry === "object" &&
            typeof (entry as EveEnvironmentSnapshot).image === "string" &&
            typeof (entry as EveEnvironmentSnapshot).createdAt === "number",
          ),
        )
      : [];
  } catch {
    return [];
  }
}

function safeSlug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || "environment"
  ).slice(0, 40);
}

function isMissingContainerError(error: unknown): boolean {
  return /\bno such (?:container|object)\b/i.test(String(error));
}

function decode(row: Row): EveManagedEnvironment {
  const expiresAt = number(row, "expires_at");
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    backend: "docker",
    containerId: text(row, "container_id"),
    containerName: text(row, "container_name"),
    image: text(row, "image"),
    status: text(row, "status") as EveManagedEnvironment["status"],
    createdAt: number(row, "created_at"),
    updatedAt: number(row, "updated_at"),
    expiresAt,
    ttlMinutes: number(row, "ttl_minutes"),
    cpu: number(row, "cpu"),
    memoryMb: number(row, "memory_mb"),
    persistent: boolean(row, "persistent"),
    network: boolean(row, "network"),
    workspace: text(row, "workspace"),
    ...(row.exit_code === null || row.exit_code === undefined
      ? {}
      : { exitCode: number(row, "exit_code") }),
    runtimeError: text(row, "runtime_error"),
    expired: expiresAt > 0 && expiresAt <= Date.now(),
    snapshots: snapshots(row.snapshots_json),
  };
}

function findDockerExecutable(): string {
  const candidates = [
    ...(process.env.PATH ?? "")
      .split(path.delimiter)
      .filter(Boolean)
      .map((directory) => path.join(directory, "docker")),
    "/usr/local/bin/docker",
    "/opt/homebrew/bin/docker",
    "/Applications/Docker.app/Contents/Resources/bin/docker",
  ];
  const executable = candidates.find((candidate) => {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
  if (!executable) {
    throw new Error("Docker was not found on this host");
  }
  return executable;
}

async function defaultDockerRunner(args: string[], timeoutMs: number): Promise<DockerRunResult> {
  try {
    return await execFileAsync(findDockerExecutable(), args, {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error as Error & { stderr?: string; stdout?: string };
    throw new Error((detail.stderr || detail.stdout || detail.message).trim().slice(0, 4000), {
      cause: error,
    });
  }
}

export class EnvironmentManager {
  private readonly ownedDatabase?: OperationsDatabase;
  readonly db: DatabaseSync;
  readonly root: string;
  readonly limits: EnvironmentLimits;
  private mutation: Promise<unknown> = Promise.resolve();

  constructor(
    database?: OperationsDatabase,
    options: {
      root?: string;
      limits?: Partial<EnvironmentLimits>;
      dockerRunner?: DockerRunner;
    } = {},
  ) {
    this.ownedDatabase = database ? undefined : openOperationsDatabase();
    this.db = database?.db ?? this.ownedDatabase!.db;
    this.root = options.root ?? path.join(resolveStateDir(), "platform", "environments");
    this.limits = {
      maxRunning: Math.max(1, Math.trunc(options.limits?.maxRunning ?? 8)),
      maxTotalCpu: Math.max(0.1, options.limits?.maxTotalCpu ?? 16),
      maxTotalMemoryMb: Math.max(128, Math.trunc(options.limits?.maxTotalMemoryMb ?? 32_768)),
    };
    this.runDocker = options.dockerRunner ?? defaultDockerRunner;
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
  }

  private readonly runDocker: DockerRunner;

  close(): void {
    this.ownedDatabase?.close();
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutation.then(operation, operation);
    this.mutation = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private row(id: string): Row {
    const row = this.db.prepare("SELECT * FROM managed_environments WHERE id=?").get(id) as
      | Row
      | undefined;
    if (!row) {
      throw new Error(`environment not found: ${id}`);
    }
    return row;
  }

  get(id: string): EveManagedEnvironment {
    return decode(this.row(id));
  }

  private saveRuntimeState(
    id: string,
    status: EveManagedEnvironment["status"],
    exitCode?: number,
    runtimeError = "",
  ): void {
    this.db
      .prepare(
        "UPDATE managed_environments SET status=?,exit_code=?,runtime_error=?,updated_at=? WHERE id=?",
      )
      .run(status, exitCode ?? null, runtimeError, Date.now(), id);
  }

  private activeEnvironments(): EveManagedEnvironment[] {
    const rows = this.db
      .prepare(`SELECT * FROM managed_environments WHERE status IN ('creating','running','paused')`)
      .all() as Row[];
    return rows.map(decode).filter((item) => ACTIVE_STATUSES.has(item.status));
  }

  private assertCapacity(cpu: number, memoryMb: number): void {
    const active = this.activeEnvironments();
    if (active.length >= this.limits.maxRunning) {
      throw new Error("maximum concurrent environment limit reached");
    }
    if (active.reduce((sum, item) => sum + item.cpu, 0) + cpu > this.limits.maxTotalCpu) {
      throw new Error("environment would exceed the total CPU limit");
    }
    if (
      active.reduce((sum, item) => sum + item.memoryMb, 0) + memoryMb >
      this.limits.maxTotalMemoryMb
    ) {
      throw new Error("environment would exceed the total memory limit");
    }
  }

  private async inspect(item: EveManagedEnvironment): Promise<EveManagedEnvironment> {
    if (!item.containerId) {
      return item;
    }
    try {
      const result = await this.runDocker(
        ["inspect", "--format", "{{json .State}}", item.containerId],
        8_000,
      );
      const state = JSON.parse(result.stdout || "{}") as Record<string, unknown>;
      const status: EveManagedEnvironment["status"] =
        state.Paused === true
          ? "paused"
          : state.Running === true
            ? "running"
            : state.Dead === true
              ? "failed"
              : item.status === "expired"
                ? "expired"
                : "stopped";
      this.saveRuntimeState(
        item.id,
        status,
        typeof state.ExitCode === "number" ? state.ExitCode : undefined,
        typeof state.Error === "string" ? state.Error : "",
      );
    } catch (error) {
      if (isMissingContainerError(error) && item.status !== "expired") {
        this.saveRuntimeState(item.id, "missing", undefined, String(error));
      } else {
        // A daemon outage, timeout, or permission error is not proof that the
        // container disappeared. Preserve quota accounting and surface the
        // transient inspection failure for operators.
        this.saveRuntimeState(item.id, item.status, item.exitCode, String(error));
      }
    }
    return this.get(item.id);
  }

  async capabilities(): Promise<JsonObject> {
    try {
      const result = await this.runDocker(["version", "--format", "{{.Server.Version}}"], 8_000);
      return {
        drivers: [
          {
            id: "docker",
            name: "Docker local/VPS",
            available: Boolean(result.stdout.trim()),
            managed: true,
          },
          { id: "eve-sandbox", name: "EVE session sandbox", available: true, managed: false },
          { id: "node", name: "Paired EVE nodes", available: true, managed: false },
        ],
        defaultImage: DEFAULT_IMAGE,
      };
    } catch (error) {
      return {
        drivers: [
          {
            id: "docker",
            name: "Docker local/VPS",
            available: false,
            managed: true,
            error: String(error),
          },
          { id: "eve-sandbox", name: "EVE session sandbox", available: true, managed: false },
          { id: "node", name: "Paired EVE nodes", available: true, managed: false },
        ],
        defaultImage: DEFAULT_IMAGE,
      };
    }
  }

  async list(): Promise<JsonObject> {
    await this.sweepExpired();
    const rows = this.db
      .prepare("SELECT * FROM managed_environments ORDER BY created_at DESC")
      .all() as Row[];
    const environments = await Promise.all(rows.map((row) => this.inspect(decode(row))));
    const counts: Record<string, number> = {};
    for (const item of environments) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return {
      environments,
      counts,
      limits: this.limits,
      ...(await this.capabilities()),
    };
  }

  async create(input: {
    name?: string;
    image?: string;
    ttlMinutes?: number;
    cpu?: number;
    memoryMb?: number;
    persistent?: boolean;
    network?: boolean;
  }): Promise<EveManagedEnvironment> {
    return await this.exclusive(async () => {
      await this.sweepExpiredUnlocked();
      const name = input.name?.trim() || "New environment";
      const image = input.image?.trim() || DEFAULT_IMAGE;
      if (image.startsWith("-")) {
        throw new Error("Docker image must not begin with '-'");
      }
      const ttlMinutes = Math.min(7 * 24 * 60, Math.max(5, Math.trunc(input.ttlMinutes ?? 120)));
      const cpu = Math.min(64, Math.max(0.1, input.cpu ?? 1));
      const memoryMb = Math.min(262_144, Math.max(128, Math.trunc(input.memoryMb ?? 1024)));
      this.assertCapacity(cpu, memoryMb);

      const id = `env_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
      const containerName = `eve-${safeSlug(name)}-${id.slice(-6)}`;
      const workspace = path.join(this.root, id, "workspace");
      const args = [
        "run",
        "-d",
        "--name",
        containerName,
        "--label",
        "eve.managed=true",
        "--label",
        `eve.environment=${id}`,
        "--security-opt",
        "no-new-privileges",
        "--cap-drop",
        "ALL",
        "--pids-limit",
        "512",
        "--cpus",
        String(cpu),
        "--memory",
        `${memoryMb}m`,
        "--shm-size",
        "512m",
      ];
      if (!input.network) {
        args.push("--network", "none");
      }
      if (input.persistent) {
        fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
        args.push("--mount", `type=bind,source=${workspace},target=/workspace`);
      } else {
        args.push("--tmpfs", "/workspace:rw,exec,size=10g");
      }
      args.push(image, "sleep", "infinity");
      const result = await this.runDocker(args, 180_000);
      const now = Date.now();
      try {
        this.db
          .prepare(
            `INSERT INTO managed_environments
           (id,name,backend,container_id,container_name,image,status,created_at,updated_at,
            expires_at,ttl_minutes,cpu,memory_mb,persistent,network,workspace,snapshots_json)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            id,
            name,
            "docker",
            result.stdout.trim(),
            containerName,
            image,
            "running",
            now,
            now,
            now + ttlMinutes * 60_000,
            ttlMinutes,
            cpu,
            memoryMb,
            input.persistent ? 1 : 0,
            input.network ? 1 : 0,
            input.persistent ? workspace : "",
            "[]",
          );
      } catch (error) {
        await this.runDocker(["rm", "-f", result.stdout.trim()], 60_000).catch(() => undefined);
        if (input.persistent) {
          fs.rmSync(workspace, { recursive: true, force: true });
        }
        throw error;
      }
      return this.get(id);
    });
  }

  async control(id: string, action: "start" | "stop" | "restart"): Promise<EveManagedEnvironment> {
    return await this.exclusive(async () => {
      await this.sweepExpiredUnlocked();
      const item = await this.inspect(this.get(id));
      if (action !== "stop" && !ACTIVE_STATUSES.has(item.status)) {
        if (item.expired || item.status === "expired") {
          throw new Error("expired environments cannot be restarted");
        }
        if (item.status === "missing") {
          throw new Error("missing environments cannot be restarted");
        }
        // Starting an inactive container consumes capacity just like create();
        // keep both transitions serialized through exclusive().
        this.assertCapacity(item.cpu, item.memoryMb);
      }
      await this.runDocker([action, item.containerId], 60_000);
      this.saveRuntimeState(id, action === "stop" ? "stopped" : "running");
      return await this.inspect(this.get(id));
    });
  }

  async snapshot(id: string, name = ""): Promise<JsonObject> {
    return await this.exclusive(async () => {
      const item = this.get(id);
      const suffix = name ? "" : `-${Date.now()}`;
      const image = `eve-snapshot:${safeSlug(name || item.name).slice(0, 40 - suffix.length)}${suffix}`;
      await this.runDocker(["commit", item.containerId, image], 300_000);
      const snapshot: EveEnvironmentSnapshot = { image, createdAt: Date.now() };
      const updatedSnapshots = [...item.snapshots, snapshot];
      this.db
        .prepare("UPDATE managed_environments SET snapshots_json=?,updated_at=? WHERE id=?")
        .run(JSON.stringify(updatedSnapshots), Date.now(), id);
      return { environment: this.get(id), snapshot };
    });
  }

  async remove(id: string): Promise<JsonObject> {
    return await this.exclusive(async () => {
      const item = this.get(id);
      try {
        await this.runDocker(["rm", "-f", item.containerId], 60_000);
      } catch (error) {
        if (!String(error).toLowerCase().includes("no such container")) {
          throw error;
        }
      }
      this.db.prepare("DELETE FROM managed_environments WHERE id=?").run(id);
      return { ok: true, id, workspacePreserved: item.persistent };
    });
  }

  private async sweepExpiredUnlocked(): Promise<JsonObject> {
    const rows = this.db
      .prepare(
        `SELECT * FROM managed_environments
         WHERE expires_at<=? AND status IN ('creating','running','paused')`,
      )
      .all(Date.now()) as Row[];
    const stopped: string[] = [];
    for (const row of rows) {
      const item = decode(row);
      try {
        await this.runDocker(["stop", item.containerId], 60_000);
      } catch (error) {
        if (!String(error).toLowerCase().includes("not running")) {
          this.saveRuntimeState(item.id, "failed", undefined, String(error));
          continue;
        }
      }
      this.saveRuntimeState(item.id, "expired");
      stopped.push(item.id);
    }
    return { ok: true, stopped, count: stopped.length };
  }

  async sweepExpired(): Promise<JsonObject> {
    return await this.exclusive(async () => await this.sweepExpiredUnlocked());
  }
}
