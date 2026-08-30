import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";
import type { EVEPluginApi } from "../api.js";
import { isSecretKey } from "./sanitize.js";
import type { JsonObject } from "./types.js";

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/giu,
  /\bsk-[A-Za-z0-9_-]{16,}\b/gu,
  /\bgh[opsu]_[A-Za-z0-9]{20,}\b/gu,
] as const;
const PII_PATTERNS = [
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gu,
  /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/gu,
  /(?<!\d)(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}(?!\d)/gu,
] as const;

type Registry = {
  candidates: Record<string, ModelCandidate>;
  active: string | null;
  history: Array<{
    from: string | null;
    to: string;
    activatedAt: number;
    previousModelRef?: string | null;
  }>;
};

type ModelConfigRuntime = Pick<EVEPluginApi["runtime"]["config"], "current" | "mutateConfigFile">;

type ModelCandidate = {
  name: string;
  modelRef: string;
  evaluation: string | null;
  decision: string;
  registeredAt: number;
};

function safeName(value: string, fallback: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function normalizeModelRef(value: string): string {
  const trimmed = value.trim();
  const modelRef = trimmed.includes("/") ? trimmed : trimmed.replace(":", "/");
  const slash = modelRef.indexOf("/");
  if (slash <= 0 || slash === modelRef.length - 1) {
    throw new Error("model ref must use provider/model format");
  }
  return modelRef;
}

function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function redactText(value: string): [string, number] {
  let output = value;
  let count = 0;
  for (const pattern of [...SECRET_PATTERNS, ...PII_PATTERNS]) {
    output = output.replace(pattern, () => {
      count += 1;
      return "[REDACTED]";
    });
  }
  return [output, count];
}

function redactValue(value: unknown): [unknown, number] {
  if (typeof value === "string") {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    let total = 0;
    const output = value.map((item) => {
      const [cleaned, count] = redactValue(item);
      total += count;
      return cleaned;
    });
    return [output, total];
  }
  if (value && typeof value === "object") {
    let total = 0;
    const output = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (isSecretKey(key)) {
          total += 1;
          return [key, "[REDACTED]"];
        }
        const [cleaned, count] = redactValue(item);
        total += count;
        return [key, cleaned];
      }),
    );
    return [output, total];
  }
  return [value, 0];
}

function validTrainingRecord(record: JsonObject): boolean {
  const nonEmptyString = (value: unknown): boolean =>
    typeof value === "string" && value.trim().length > 0;
  if (Array.isArray(record.messages) && record.messages.length >= 2) {
    return record.messages.every(
      (message) =>
        message &&
        typeof message === "object" &&
        !Array.isArray(message) &&
        nonEmptyString((message as JsonObject).role) &&
        nonEmptyString((message as JsonObject).content),
    );
  }
  return [
    ["input", "output"],
    ["prompt", "response"],
    ["instruction", "response"],
  ].some(([left, right]) => nonEmptyString(record[left]) && nonEmptyString(record[right]));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  }
  return value;
}

function atomicJson(target: string, value: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(sortValue(value), null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function readObject(target: string): JsonObject {
  const value = JSON.parse(fs.readFileSync(target, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`expected JSON object: ${target}`);
  }
  return value as JsonObject;
}

export class ModelLabService {
  constructor(
    readonly root = path.join(resolveStateDir(), "model-lab"),
    private readonly configRuntime?: ModelConfigRuntime,
  ) {}

  prepareDataset(inputPath: string, name = "dataset"): JsonObject {
    const source = path.resolve(inputPath);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error(`input JSONL does not exist: ${source}`);
    }
    const accepted: JsonObject[] = [];
    const rejected: JsonObject[] = [];
    const seen = new Set<string>();
    let redactions = 0;
    fs.readFileSync(source, "utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (!line.trim()) {
          return;
        }
        const rawHash = hash(line);
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          rejected.push({ line: index + 1, reason: "invalid_json", sha256: rawHash });
          return;
        }
        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed) ||
          !validTrainingRecord(parsed as JsonObject)
        ) {
          rejected.push({ line: index + 1, reason: "invalid_schema", sha256: rawHash });
          return;
        }
        const [cleaned, count] = redactValue(parsed);
        const canonical = JSON.stringify(sortValue(cleaned));
        const digest = hash(canonical);
        if (seen.has(digest)) {
          rejected.push({ line: index + 1, reason: "duplicate", sha256: rawHash });
          return;
        }
        seen.add(digest);
        redactions += count;
        accepted.push(cleaned as JsonObject);
      });
    const payload =
      accepted.map((item) => JSON.stringify(sortValue(item))).join("\n") +
      (accepted.length ? "\n" : "");
    const sha256 = hash(payload);
    const datasetId = sha256.slice(0, 16);
    const targetRoot = path.join(
      this.root,
      "datasets",
      `${safeName(name, "dataset")}-${datasetId}`,
    );
    const datasetPath = path.join(targetRoot, "dataset.jsonl");
    fs.mkdirSync(targetRoot, { recursive: true, mode: 0o700 });
    if (fs.existsSync(datasetPath) && fs.readFileSync(datasetPath, "utf8") !== payload) {
      throw new Error(`immutable dataset collision at ${datasetPath}`);
    }
    fs.writeFileSync(datasetPath, payload, { mode: 0o600 });
    const manifest = {
      datasetId,
      name: safeName(name, "dataset"),
      source,
      records: accepted.length,
      rejected: rejected.length,
      redactions,
      sha256,
      datasetPath,
      createdAt: Date.now(),
    };
    atomicJson(path.join(targetRoot, "manifest.json"), manifest);
    atomicJson(path.join(targetRoot, "rejected.json"), rejected);
    return manifest;
  }

  private metrics(filePath: string): Record<string, number> {
    const object = readObject(path.resolve(filePath));
    const values =
      object.metrics && typeof object.metrics === "object" && !Array.isArray(object.metrics)
        ? (object.metrics as JsonObject)
        : object;
    const metrics = Object.fromEntries(
      Object.entries(values).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    );
    if (Object.keys(metrics).length === 0) {
      throw new Error(`metrics file has no numeric metrics: ${filePath}`);
    }
    return metrics;
  }

  compare(
    baselinePath: string,
    candidatePath: string,
    input: {
      candidateName: string;
      maxRegression?: number;
      minImprovement?: number;
      required?: Record<string, number>;
    },
  ): JsonObject {
    const baseline = this.metrics(baselinePath);
    const candidate = this.metrics(candidatePath);
    const metricDirections: Record<string, 1 | -1> = {
      quality: 1,
      success: 1,
      toolSuccess: 1,
      failed: -1,
      latencyMs: -1,
      estimatedCostUsd: -1,
      costUsd: -1,
    };
    const shared = Object.keys(baseline)
      .filter((key) => key in candidate && key in metricDirections)
      .toSorted();
    if (shared.length === 0) {
      throw new Error("baseline and candidate have no supported metrics in common");
    }
    const deltas = Object.fromEntries(
      shared.map((key) => {
        const scale = Math.max(Math.abs(baseline[key]), Math.abs(candidate[key]), 1);
        return [key, ((candidate[key] - baseline[key]) * metricDirections[key]) / scale];
      }),
    );
    const meanDelta = Object.values(deltas).reduce((sum, value) => sum + value, 0) / shared.length;
    const maxRegression = Math.abs(input.maxRegression ?? 0.02);
    const regressions = Object.fromEntries(
      Object.entries(deltas).filter(([, delta]) => delta < -maxRegression),
    );
    const gateFailures = Object.fromEntries(
      Object.entries(input.required ?? {})
        .filter(([key, minimum]) => (candidate[key] ?? Number.NEGATIVE_INFINITY) < minimum)
        .map(([key, minimum]) => [key, { actual: candidate[key] ?? null, minimum }]),
    );
    const decision =
      Object.keys(regressions).length === 0 &&
      Object.keys(gateFailures).length === 0 &&
      meanDelta >= (input.minImprovement ?? 0)
        ? "accept"
        : "reject";
    const report = {
      candidate: input.candidateName,
      decision,
      baseline,
      candidateMetrics: candidate,
      deltas,
      meanDelta,
      maxRegression,
      minImprovement: input.minImprovement ?? 0,
      regressions,
      gateFailures,
      createdAt: Date.now(),
    };
    const reportPath = path.join(
      this.root,
      "evaluations",
      `${safeName(input.candidateName, "candidate")}-${Date.now()}.json`,
    );
    atomicJson(reportPath, { ...report, reportPath });
    return { ...report, reportPath };
  }

  private registryPath(): string {
    return path.join(this.root, "registry.json");
  }

  private registry(): Registry {
    if (!fs.existsSync(this.registryPath())) {
      return { candidates: {}, active: null, history: [] };
    }
    const value = readObject(this.registryPath()) as unknown as Registry;
    return {
      candidates: value.candidates ?? {},
      active: value.active ?? null,
      history: value.history ?? [],
    };
  }

  register(name: string, modelRef: string, evaluation?: string): ModelCandidate {
    const registry = this.registry();
    const report = evaluation ? readObject(path.resolve(evaluation)) : undefined;
    const candidate: ModelCandidate = {
      name,
      modelRef: normalizeModelRef(modelRef),
      evaluation: evaluation ? path.resolve(evaluation) : null,
      decision: typeof report?.decision === "string" ? report.decision : "unverified",
      registeredAt: Date.now(),
    };
    registry.candidates[name] = candidate;
    atomicJson(this.registryPath(), registry);
    return candidate;
  }

  private runtimeModelRef(): string | null {
    const model = this.configRuntime?.current().agents?.defaults?.model;
    if (typeof model === "string") {
      return model.trim() || null;
    }
    return typeof model?.primary === "string" && model.primary.trim() ? model.primary.trim() : null;
  }

  private async setRuntimeModelRef(modelRef: string | null): Promise<void> {
    if (!this.configRuntime) {
      throw new Error("model activation requires the EVE runtime config service");
    }
    await this.configRuntime.mutateConfigFile({
      base: "runtime",
      afterWrite: { mode: "auto" },
      mutate(draft) {
        draft.agents ??= {};
        draft.agents.defaults ??= {};
        const current = draft.agents.defaults.model;
        if (modelRef) {
          draft.agents.defaults.model =
            current && typeof current === "object" ? { ...current, primary: modelRef } : modelRef;
          return;
        }
        if (current && typeof current === "object") {
          const { primary: _primary, ...remaining } = current;
          if (Object.keys(remaining).length > 0) {
            draft.agents.defaults.model = remaining;
            return;
          }
        }
        delete draft.agents.defaults.model;
      },
    });
  }

  async activate(name: string, allowUnverified = false): Promise<JsonObject> {
    const registry = this.registry();
    const candidate = registry.candidates[name];
    if (!candidate) {
      throw new Error(`unknown candidate: ${name}`);
    }
    if (candidate.decision !== "accept" && !allowUnverified) {
      throw new Error("candidate has not passed evaluation; use an accepted report first");
    }
    const previous = registry.active;
    const previousModelRef = this.runtimeModelRef();
    await this.setRuntimeModelRef(candidate.modelRef);
    registry.active = name;
    registry.history.push({
      from: previous,
      to: name,
      activatedAt: Date.now(),
      previousModelRef,
    });
    try {
      atomicJson(this.registryPath(), registry);
    } catch (error) {
      await this.setRuntimeModelRef(previousModelRef);
      throw error;
    }
    return { active: name, previous, modelRef: candidate.modelRef, previousModelRef };
  }

  async rollback(): Promise<JsonObject> {
    const registry = this.registry();
    const last = registry.history.pop();
    if (!last) {
      throw new Error("no activation history to roll back");
    }
    const rolledBackFrom = registry.active;
    const previousModelRef =
      "previousModelRef" in last
        ? last.previousModelRef
        : last.from
          ? (registry.candidates[last.from]?.modelRef ?? null)
          : null;
    await this.setRuntimeModelRef(previousModelRef ?? null);
    registry.active = last.from;
    try {
      atomicJson(this.registryPath(), registry);
    } catch (error) {
      await this.setRuntimeModelRef(
        this.registry().candidates[rolledBackFrom ?? ""]?.modelRef ?? null,
      );
      throw error;
    }
    return { active: registry.active, rolledBackFrom, modelRef: previousModelRef ?? null };
  }

  status(): JsonObject {
    const registry = this.registry();
    const runtimeModelRef = this.runtimeModelRef();
    const activeModelRef = registry.active
      ? (registry.candidates[registry.active]?.modelRef ?? null)
      : null;
    return {
      ...registry,
      runtimeModelRef,
      synchronized: registry.active === null || activeModelRef === runtimeModelRef,
    } as unknown as JsonObject;
  }
}
