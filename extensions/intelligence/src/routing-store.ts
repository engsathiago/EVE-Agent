import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { OperationsDatabase } from "./database.js";
import { openOperationsDatabase, parseJsonObject } from "./database.js";
import type {
  EveExperiment,
  EveExperimentStatus,
  EveRouteCandidate,
  EveRouteDecision,
  EveRouteObservation,
  JsonObject,
} from "./types.js";

type Row = Record<string, unknown>;

const TASK_PATTERNS = {
  coding:
    /\b(c[oó]digo|code|bug|teste?|test|python|javascript|typescript|git|sql|api|refator)\w*/giu,
  research: /\b(pesquis\w*|research|fontes?|refer[eê]ncias?|compare|mercado|not[ií]cias?)\b/giu,
  creative: /\b(crie|escreva|roteiro|campanha|imagem|v[ií]deo|design|criativ\w*)\b/giu,
  operations: /\b(vps|servidor|deploy|docker|linux|backup|monitor\w*|instal\w*|ssh)\b/giu,
  analysis: /\b(analise|an[aá]lise|explique|planeje|estrat[eé]gia|racioc[ií]nio)\b/giu,
} as const;

function text(row: Row, key: string): string {
  return typeof row[key] === "string" ? row[key] : "";
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : 0;
}

export function classifyTask(prompt: string): string {
  let best = "general";
  let bestScore = 0;
  for (const [kind, pattern] of Object.entries(TASK_PATTERNS)) {
    pattern.lastIndex = 0;
    const score = [...prompt.matchAll(pattern)].length;
    if (score > bestScore) {
      best = kind;
      bestScore = score;
    }
  }
  return best;
}

function decodeExperiment(row: Row): EveExperiment {
  const baselineRuns = number(row, "baseline_runs");
  const candidateRuns = number(row, "candidate_runs");
  const baselineScore = baselineRuns > 0 ? number(row, "baseline_score") / baselineRuns : 0;
  const candidateScore = candidateRuns > 0 ? number(row, "candidate_score") / candidateRuns : 0;
  const minSamples = number(row, "min_samples");
  const maxRegression = number(row, "max_regression");
  const ready = baselineRuns >= minSamples && candidateRuns >= minSamples;
  const decision = !ready
    ? "collect"
    : candidateScore >= baselineScore - maxRegression
      ? "promote"
      : "stop";
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    kind: text(row, "kind"),
    baseline: text(row, "baseline"),
    candidate: text(row, "candidate"),
    trafficPercent: number(row, "traffic_percent"),
    status: text(row, "status") as EveExperimentStatus,
    minSamples,
    maxRegression,
    baselineRuns,
    candidateRuns,
    baselineScore,
    candidateScore,
    decision,
    createdAt: number(row, "created_at"),
    updatedAt: number(row, "updated_at"),
    metadata: parseJsonObject(row.metadata_json),
  };
}

export class RoutingStore {
  private readonly ownedDatabase?: OperationsDatabase;
  readonly db: DatabaseSync;

  constructor(
    database?: OperationsDatabase,
    private readonly options: { enabled: boolean; candidates: EveRouteCandidate[] } = {
      enabled: false,
      candidates: [],
    },
  ) {
    this.ownedDatabase = database ? undefined : openOperationsDatabase();
    this.db = database?.db ?? this.ownedDatabase!.db;
  }

  close(): void {
    this.ownedDatabase?.close();
  }

  record(input: EveRouteObservation): void {
    this.db
      .prepare(
        `INSERT INTO route_observations
         (task_kind,model,provider,success,quality,latency_ms,cost_usd,tool_success,created_at,metadata_json)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.taskKind,
        input.model,
        input.provider ?? "",
        input.success ? 1 : 0,
        Math.max(0, Math.min(1, input.quality ?? (input.success ? 1 : 0))),
        Math.max(0, Math.trunc(input.latencyMs ?? 0)),
        Math.max(0, input.costUsd ?? 0),
        Math.max(0, Math.min(1, input.toolSuccess ?? (input.success ? 1 : 0))),
        Date.now(),
        JSON.stringify(input.metadata ?? {}),
      );
  }

  recommend(
    prompt: string,
    candidates: EveRouteCandidate[],
    options: { currentModel?: string; currentProvider?: string; experimentKey?: string } = {},
  ): EveRouteDecision {
    if (candidates.length === 0) {
      throw new Error("at least one routing candidate is required");
    }
    const taskKind = classifyTask(prompt);
    const scored = candidates
      .filter(
        (candidate) =>
          !candidate.tasks ||
          candidate.tasks.includes(taskKind) ||
          candidate.tasks.includes("general"),
      )
      .map((candidate) => {
        const provider = candidate.provider ?? options.currentProvider ?? "";
        const row = this.db
          .prepare(
            `SELECT COUNT(*) samples,AVG(success) success_rate,AVG(quality) quality,
             AVG(latency_ms) latency_ms,AVG(cost_usd) cost_usd,AVG(tool_success) tool_success
             FROM route_observations WHERE task_kind=? AND model=? AND provider=?`,
          )
          .get(taskKind, candidate.model, provider) as Row;
        const samples = number(row, "samples");
        const success = samples > 0 ? number(row, "success_rate") : 0.5;
        const quality = samples > 0 ? number(row, "quality") : 0.5;
        const toolSuccess = samples > 0 ? number(row, "tool_success") : 0.5;
        const latency =
          samples > 0 ? number(row, "latency_ms") : (candidate.expectedLatencyMs ?? 2000);
        const cost = samples > 0 ? number(row, "cost_usd") : (candidate.expectedCostUsd ?? 0.01);
        const efficiency = 1 / (1 + latency / 10_000 + cost * 10);
        const prior = Math.min(1, samples / 10);
        const evidence = success * 0.45 + quality * 0.3 + toolSuccess * 0.15 + efficiency * 0.1;
        const neutral = candidate.model === options.currentModel ? 0.55 : 0.5;
        const score = evidence * prior + neutral * (1 - prior);
        return { model: candidate.model, provider, score, samples };
      });
    if (scored.length === 0) {
      throw new Error(`no routing candidate supports task kind ${taskKind}`);
    }
    scored.sort(
      (a, b) => b.score - a.score || b.samples - a.samples || a.model.localeCompare(b.model),
    );
    let selected = scored[0];
    let experiment: EveRouteDecision["experiment"];
    if (options.experimentKey) {
      const active = this.listExperiments().find(
        (item) => item.kind === "model-routing" && item.status === "running",
      );
      if (active) {
        const arm = this.assignExperiment(active.id, options.experimentKey);
        const experimentModel = arm === "candidate" ? active.candidate : active.baseline;
        const assigned = scored.find((candidate) => candidate.model === experimentModel);
        if (assigned) {
          selected = assigned;
          experiment = { id: active.id, name: active.name, arm };
        }
      }
    }
    return {
      taskKind,
      model: selected.model,
      provider: selected.provider,
      score: selected.score,
      reason: experiment
        ? `${experiment.arm} arm of ${experiment.name}`
        : selected.samples > 0
          ? `best observed outcome for ${taskKind}`
          : `best prior for ${taskKind}`,
      candidates: scored,
      ...(experiment ? { experiment } : {}),
    };
  }

  routerStatus(): JsonObject {
    const rows = this.db
      .prepare(
        `SELECT task_kind,model,provider,COUNT(*) samples,AVG(success) success_rate,
         AVG(quality) quality,AVG(latency_ms) latency_ms,AVG(cost_usd) cost_usd
         FROM route_observations GROUP BY task_kind,model,provider
         ORDER BY task_kind,samples DESC`,
      )
      .all() as Row[];
    return {
      enabled: this.options.enabled,
      candidates: this.options.candidates,
      observations: rows.map((row) => ({
        taskKind: text(row, "task_kind"),
        model: text(row, "model"),
        provider: text(row, "provider"),
        samples: number(row, "samples"),
        successRate: number(row, "success_rate"),
        quality: number(row, "quality"),
        latencyMs: number(row, "latency_ms"),
        costUsd: number(row, "cost_usd"),
      })),
    };
  }

  createExperiment(input: {
    name: string;
    kind: string;
    baseline: string;
    candidate: string;
    trafficPercent?: number;
    minSamples?: number;
    maxRegression?: number;
    metadata?: JsonObject;
  }): EveExperiment {
    const id = `exp_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO experiments
         (id,name,kind,baseline,candidate,traffic_percent,status,min_samples,max_regression,created_at,updated_at,metadata_json)
         VALUES(?,?,?,?,?,?,'draft',?,?,?,?,?)`,
      )
      .run(
        id,
        input.name.trim(),
        input.kind,
        input.baseline,
        input.candidate,
        Math.max(0, Math.min(100, input.trafficPercent ?? 5)),
        Math.max(1, Math.trunc(input.minSamples ?? 20)),
        Math.max(0, input.maxRegression ?? 0.02),
        now,
        now,
        JSON.stringify(input.metadata ?? {}),
      );
    return this.getExperiment(id);
  }

  getExperiment(idOrName: string): EveExperiment {
    const row = this.db
      .prepare("SELECT * FROM experiments WHERE id=? OR name=? LIMIT 1")
      .get(idOrName, idOrName) as Row | undefined;
    if (!row) {
      throw new Error(`experiment not found: ${idOrName}`);
    }
    return decodeExperiment(row);
  }

  listExperiments(): EveExperiment[] {
    return (
      this.db.prepare("SELECT * FROM experiments ORDER BY updated_at DESC").all() as Row[]
    ).map(decodeExperiment);
  }

  setExperimentStatus(idOrName: string, status: EveExperimentStatus): EveExperiment {
    const experiment = this.getExperiment(idOrName);
    this.db
      .prepare("UPDATE experiments SET status=?,updated_at=? WHERE id=?")
      .run(status, Date.now(), experiment.id);
    return this.getExperiment(experiment.id);
  }

  assignExperiment(idOrName: string, key: string): "baseline" | "candidate" {
    const experiment = this.getExperiment(idOrName);
    if (experiment.status !== "running") {
      return "baseline";
    }
    const bucket =
      Number.parseInt(
        createHash("sha256").update(`${experiment.id}:${key}`).digest("hex").slice(0, 8),
        16,
      ) % 10_000;
    return bucket < experiment.trafficPercent * 100 ? "candidate" : "baseline";
  }

  recordExperiment(idOrName: string, arm: "baseline" | "candidate", score: number): EveExperiment {
    const experiment = this.getExperiment(idOrName);
    if (experiment.status !== "running") {
      throw new Error(`experiment is not running: ${experiment.name}`);
    }
    const runsColumn = arm === "baseline" ? "baseline_runs" : "candidate_runs";
    const scoreColumn = arm === "baseline" ? "baseline_score" : "candidate_score";
    this.db
      .prepare(
        `UPDATE experiments SET ${runsColumn}=${runsColumn}+1,${scoreColumn}=${scoreColumn}+?,updated_at=? WHERE id=?`,
      )
      .run(score, Date.now(), experiment.id);
    const updated = this.getExperiment(experiment.id);
    if (updated.decision === "promote") {
      return this.setExperimentStatus(updated.id, "promoted");
    }
    if (updated.decision === "stop") {
      return this.setExperimentStatus(updated.id, "stopped");
    }
    return updated;
  }
}
