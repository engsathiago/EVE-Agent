import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";
import type { TraceStore } from "./trace-store.js";
import type { EveTraceRun, JsonObject } from "./types.js";

export type EvalCheck = { type: string; value?: unknown };
export type EvalCase = {
  id: string;
  prompt: string;
  checks: EvalCheck[];
  tags?: string[];
  sourceTrace?: string;
};
export type EvalResponse = {
  output: string;
  stderr?: string;
  returnCode: number;
  latencyMs: number;
  trace?: EveTraceRun;
};
export type EvalRunner = (prompt: string, timeoutMs: number) => Promise<EvalResponse>;

type EvalCaseResult = {
  id: string;
  repetition: number;
  passed: boolean;
  checks: Array<{ passed: boolean; check: string }>;
  output: string;
  error: string;
  latencyMs: number;
  traceId?: string;
  model?: string;
  provider?: string;
  toolCalls: number;
  modelCalls: number;
  estimatedCostUsd: number;
  tags: string[];
};

export type EvalReport = {
  schemaVersion: 1;
  suite: string;
  suitePath: string;
  createdAt: string;
  repetitions: number;
  total: number;
  passed: number;
  failed: number;
  score: number;
  latencyMs: number;
  estimatedCostUsd: number;
  toolCalls: number;
  modelCalls: number;
  results: EvalCaseResult[];
  reportPath: string;
};

const STARTER_CASES: EvalCase[] = [
  {
    id: "sum-01",
    prompt: "Responda apenas com o resultado de 2 + 2.",
    checks: [{ type: "contains", value: "4" }],
    tags: ["basic"],
  },
  {
    id: "json-01",
    prompt: "Retorne um JSON válido com a chave ok igual a true.",
    checks: [{ type: "json" }],
    tags: ["format"],
  },
  {
    id: "brief-01",
    prompt: "Explique RAM para uma pessoa leiga em até 20 palavras.",
    checks: [{ type: "max_words", value: 20 }],
    tags: ["clarity"],
  },
  {
    id: "pt-01",
    prompt: "Diga olá em português.",
    checks: [{ type: "contains", value: "olá" }],
    tags: ["language"],
  },
  {
    id: "no-markdown-01",
    prompt: "Responda somente: pronto",
    checks: [{ type: "regex", value: "^\\s*[Pp]ronto[.!]?\\s*$" }],
    tags: ["format"],
  },
  {
    id: "list-01",
    prompt: "Liste exatamente três cores primárias de forma curta.",
    checks: [{ type: "max_words", value: 12 }],
    tags: ["format"],
  },
  {
    id: "translate-01",
    prompt: "Traduza 'good morning' para português.",
    checks: [{ type: "contains", value: "bom dia" }],
    tags: ["language"],
  },
  {
    id: "math-02",
    prompt: "Quanto é 12 vezes 3?",
    checks: [{ type: "contains", value: "36" }],
    tags: ["basic"],
  },
  {
    id: "logic-01",
    prompt: "Se todos A são B e x é A, x é B? Responda sim ou não.",
    checks: [{ type: "contains", value: "sim" }],
    tags: ["reasoning"],
  },
  {
    id: "upper-01",
    prompt: "Escreva EVE em letras minúsculas.",
    checks: [{ type: "contains", value: "eve" }],
    tags: ["format"],
  },
  {
    id: "date-01",
    prompt: "Qual formato ISO representa ano, mês e dia?",
    checks: [{ type: "contains", value: "YYYY-MM-DD" }],
    tags: ["basic"],
  },
  {
    id: "code-01",
    prompt: "Escreva apenas a expressão JavaScript que soma a e b.",
    checks: [{ type: "contains", value: "a + b" }],
    tags: ["coding"],
  },
  {
    id: "sql-01",
    prompt: "Qual palavra SQL seleciona linhas?",
    checks: [{ type: "contains", value: "SELECT" }],
    tags: ["coding"],
  },
  {
    id: "git-01",
    prompt: "Qual comando Git mostra o estado do repositório?",
    checks: [{ type: "contains", value: "git status" }],
    tags: ["coding"],
  },
  {
    id: "http-01",
    prompt: "Qual código HTTP normalmente significa não encontrado?",
    checks: [{ type: "contains", value: "404" }],
    tags: ["basic"],
  },
  {
    id: "boolean-01",
    prompt: "Retorne somente true em minúsculas.",
    checks: [{ type: "regex", value: "^\\s*true\\s*$" }],
    tags: ["format"],
  },
  {
    id: "empty-01",
    prompt: "Responda com uma frase curta sobre testes.",
    checks: [{ type: "regex", value: ".+" }],
    tags: ["basic"],
  },
  {
    id: "words-01",
    prompt: "Defina API em até 15 palavras.",
    checks: [{ type: "max_words", value: 15 }],
    tags: ["clarity"],
  },
  {
    id: "docker-01",
    prompt: "Qual arquivo costuma definir uma imagem Docker?",
    checks: [{ type: "contains", value: "Dockerfile" }],
    tags: ["operations"],
  },
  {
    id: "linux-01",
    prompt: "Qual comando imprime o diretório atual no Linux?",
    checks: [{ type: "contains", value: "pwd" }],
    tags: ["operations"],
  },
  {
    id: "json-02",
    prompt: "Retorne um array JSON vazio.",
    checks: [{ type: "json" }],
    tags: ["format"],
  },
  {
    id: "yaml-01",
    prompt: "YAML usa indentação significativa? Responda sim ou não.",
    checks: [{ type: "contains", value: "sim" }],
    tags: ["basic"],
  },
  {
    id: "regex-01",
    prompt: "Escreva apenas três dígitos.",
    checks: [{ type: "regex", value: "^\\s*\\d{3}\\s*$" }],
    tags: ["format"],
  },
  {
    id: "security-01",
    prompt: "Diga em até 10 palavras por que não se deve publicar uma chave de API.",
    checks: [{ type: "max_words", value: 10 }],
    tags: ["operations"],
  },
  {
    id: "backup-01",
    prompt: "Defina backup em até 12 palavras.",
    checks: [{ type: "max_words", value: 12 }],
    tags: ["operations"],
  },
  {
    id: "latency-01",
    prompt: "Defina latência em até 12 palavras.",
    checks: [{ type: "max_words", value: 12 }],
    tags: ["operations"],
  },
  {
    id: "agent-01",
    prompt: "O que é um agente de software? Responda em uma frase.",
    checks: [{ type: "max_words", value: 30 }],
    tags: ["agent"],
  },
  {
    id: "trace-01",
    prompt: "Defina trace operacional em até 20 palavras.",
    checks: [{ type: "max_words", value: 20 }],
    tags: ["agent"],
  },
  {
    id: "eval-01",
    prompt: "Defina avaliação de modelo em até 20 palavras.",
    checks: [{ type: "max_words", value: 20 }],
    tags: ["agent"],
  },
  {
    id: "final-01",
    prompt: "Responda somente com EVE.",
    checks: [{ type: "regex", value: "^\\s*EVE[.!]?\\s*$" }],
    tags: ["format"],
  },
];

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^[-.]|[-.]$/g, "") || "starter";
}

function loadJsonFile(filePath: string): JsonObject {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`expected JSON object: ${filePath}`);
  }
  return value as JsonObject;
}

export class EvalSuiteService {
  readonly root: string;

  constructor(
    private readonly traces: TraceStore,
    root = path.join(resolveStateDir(), "evals"),
  ) {
    this.root = root;
  }

  init(name = "starter", count = 30, overwrite = false): JsonObject {
    const suite = safeName(name);
    const selected = STARTER_CASES.slice(
      0,
      Math.max(1, Math.min(STARTER_CASES.length, Math.trunc(count))),
    );
    const suitePath = path.join(this.root, "suites", `${suite}.jsonl`);
    if (fs.existsSync(suitePath) && !overwrite) {
      throw new Error(`suite already exists: ${suitePath}`);
    }
    fs.mkdirSync(path.dirname(suitePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(suitePath, `${selected.map((item) => JSON.stringify(item)).join("\n")}\n`, {
      mode: 0o600,
    });
    return { suite, path: suitePath, cases: selected.length };
  }

  resolve(value: string): string {
    const direct = path.resolve(value);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      return direct;
    }
    const named = path.join(this.root, "suites", `${value}.jsonl`);
    if (!fs.existsSync(named)) {
      throw new Error(`evaluation suite not found: ${value}`);
    }
    return named;
  }

  load(value: string): EvalCase[] {
    const suitePath = this.resolve(value);
    const cases = fs
      .readFileSync(suitePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line, index) => {
        const item = JSON.parse(line) as Partial<EvalCase>;
        if (!item.id || !item.prompt || !Array.isArray(item.checks)) {
          throw new Error(`invalid evaluation case at line ${index + 1}`);
        }
        return item as EvalCase;
      });
    if (cases.length === 0) {
      throw new Error("evaluation suite is empty");
    }
    return cases;
  }

  check(output: string, check: EvalCheck, response: EvalResponse): [boolean, string] {
    const type = check.type.toLowerCase();
    const value = check.value;
    const trace = response.trace;
    let passed: boolean;
    if (type === "contains") {
      passed = output.toLowerCase().includes(String(value).toLowerCase());
    } else if (type === "not_contains") {
      passed = !output.toLowerCase().includes(String(value).toLowerCase());
    } else if (type === "regex") {
      passed = new RegExp(String(value), "u").test(output);
    } else if (type === "json") {
      try {
        JSON.parse(output);
        passed = true;
      } catch {
        passed = false;
      }
    } else if (type === "max_words") {
      passed = output.trim().split(/\s+/).filter(Boolean).length <= Number(value);
    } else if (type === "tool_called" || type === "tool_not_called") {
      const tools = new Set(
        (trace?.events ?? [])
          .filter((event) => event.eventType === "after_tool_call")
          .map((event) =>
            typeof event.payload.toolName === "string" ? event.payload.toolName : "",
          ),
      );
      passed = type === "tool_called" ? tools.has(String(value)) : !tools.has(String(value));
    } else if (type === "max_tool_calls") {
      passed = (trace?.toolCalls ?? 0) <= Number(value);
    } else if (type === "min_tool_calls") {
      passed = (trace?.toolCalls ?? 0) >= Number(value);
    } else if (type === "model_is") {
      passed = trace?.model === String(value);
    } else if (type === "provider_is") {
      passed = trace?.provider === String(value);
    } else if (type === "max_latency_ms") {
      passed = response.latencyMs <= Number(value);
    } else if (type === "max_latency_seconds") {
      passed = response.latencyMs <= Number(value) * 1000;
    } else if (type === "max_cost_usd") {
      passed = (trace?.estimatedCostUsd ?? 0) <= Number(value);
    } else if (type === "trace_status") {
      passed = trace?.status === String(value);
    } else if (type === "artifact_exists") {
      passed = fs.existsSync(path.resolve(String(value)));
    } else {
      return [false, `unknown check: ${type}`];
    }
    return [passed, `${type}=${JSON.stringify(value)}`];
  }

  async defaultRunner(prompt: string, timeoutMs: number): Promise<EvalResponse> {
    const runKey = `eval-${randomUUID()}`;
    const started = Date.now();
    const script = process.argv[1];
    if (!script) {
      throw new Error("unable to resolve EVE CLI entrypoint");
    }
    return await new Promise<EvalResponse>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [script, "agent", "--local", "--message", prompt, "--json"],
        {
          env: { ...process.env, EVE_EVAL_RUN_KEY: runKey },
        },
      );
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let settled = false;
      let timedOut = false;
      let forceKillTimer: NodeJS.Timeout | undefined;
      const settle = (response: EvalResponse): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(response);
      };
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        // Keep this timer referenced: an eval that ignores SIGTERM must not
        // outlive the evaluator process after the timeout result is returned.
        forceKillTimer = setTimeout(() => {
          child.kill("SIGKILL");
          settle({
            output: "",
            stderr: "evaluation timed out",
            returnCode: 124,
            latencyMs: Date.now() - started,
            trace: this.traces.findByEvaluationRunKey(runKey),
          });
        }, 2_000);
      }, timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.once("error", (error) => {
        if (timedOut) {
          return;
        }
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      });
      child.once("close", (code) => {
        if (settled) {
          return;
        }
        if (timedOut) {
          clearTimeout(forceKillTimer);
          settle({
            output: "",
            stderr: "evaluation timed out",
            returnCode: 124,
            latencyMs: Date.now() - started,
            trace: this.traces.findByEvaluationRunKey(runKey),
          });
          return;
        }
        const raw = Buffer.concat(stdout).toString("utf8").trim();
        let output = raw;
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          output =
            [parsed.reply, parsed.output, parsed.text].find(
              (value): value is string => typeof value === "string",
            ) ?? raw;
        } catch {
          // Plain output is a supported CLI fallback.
        }
        settle({
          output,
          stderr: Buffer.concat(stderr).toString("utf8").trim(),
          returnCode: code ?? 1,
          latencyMs: Date.now() - started,
          trace: this.traces.findByEvaluationRunKey(runKey),
        });
      });
    });
  }

  async run(
    suite: string,
    options: { repetitions?: number; timeoutMs?: number; runner?: EvalRunner } = {},
  ): Promise<EvalReport> {
    const suitePath = this.resolve(suite);
    const cases = this.load(suitePath);
    const repetitions = Math.max(1, Math.min(10, Math.trunc(options.repetitions ?? 1)));
    const timeoutMs = Math.max(1000, Math.trunc(options.timeoutMs ?? 120_000));
    const runner = options.runner ?? ((prompt, timeout) => this.defaultRunner(prompt, timeout));
    const results: EvalCaseResult[] = [];
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      for (const item of cases) {
        try {
          const response = await runner(item.prompt, timeoutMs);
          const checks = item.checks.map((check) => {
            const [passed, label] = this.check(response.output, check, response);
            return { passed, check: label };
          });
          results.push({
            id: item.id,
            repetition,
            passed:
              response.returnCode === 0 &&
              checks.length > 0 &&
              checks.every((check) => check.passed),
            checks,
            output: response.output.slice(0, 12_000),
            error: (response.stderr ?? "").slice(0, 4000),
            latencyMs: response.latencyMs,
            ...(response.trace?.id ? { traceId: response.trace.id } : {}),
            ...(response.trace?.model ? { model: response.trace.model } : {}),
            ...(response.trace?.provider ? { provider: response.trace.provider } : {}),
            toolCalls: response.trace?.toolCalls ?? 0,
            modelCalls: response.trace?.modelCalls ?? 0,
            estimatedCostUsd: response.trace?.estimatedCostUsd ?? 0,
            tags: item.tags ?? [],
          });
        } catch (error) {
          results.push({
            id: item.id,
            repetition,
            passed: false,
            checks: [],
            output: "",
            error: String(error).slice(0, 4000),
            latencyMs: 0,
            toolCalls: 0,
            modelCalls: 0,
            estimatedCostUsd: 0,
            tags: item.tags ?? [],
          });
        }
      }
    }
    const passed = results.filter((result) => result.passed).length;
    const runsRoot = path.join(this.root, "runs");
    fs.mkdirSync(runsRoot, { recursive: true, mode: 0o700 });
    const reportPath = path.join(
      runsRoot,
      `${path.basename(suitePath, ".jsonl")}-${Date.now()}.json`,
    );
    const report: EvalReport = {
      schemaVersion: 1,
      suite: path.basename(suitePath, ".jsonl"),
      suitePath,
      createdAt: new Date().toISOString(),
      repetitions,
      total: results.length,
      passed,
      failed: results.length - passed,
      score: results.length === 0 ? 0 : passed / results.length,
      latencyMs: results.reduce((sum, item) => sum + item.latencyMs, 0),
      estimatedCostUsd: results.reduce((sum, item) => sum + item.estimatedCostUsd, 0),
      toolCalls: results.reduce((sum, item) => sum + item.toolCalls, 0),
      modelCalls: results.reduce((sum, item) => sum + item.modelCalls, 0),
      results,
      reportPath,
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    return report;
  }

  compare(
    baselinePath: string,
    candidatePath: string,
    options: { maxRegression?: number; minImprovement?: number } = {},
  ): JsonObject {
    const baseline = loadJsonFile(path.resolve(baselinePath));
    const candidate = loadJsonFile(path.resolve(candidatePath));
    const baselineScore = Number(baseline.score ?? 0);
    const candidateScore = Number(candidate.score ?? 0);
    const delta = candidateScore - baselineScore;
    const maxRegression = Math.abs(options.maxRegression ?? 0.02);
    const minImprovement = Math.max(0, options.minImprovement ?? 0);
    const accepted = delta >= -maxRegression && (minImprovement === 0 || delta >= minImprovement);
    return {
      accepted,
      decision: accepted ? "accept" : "reject",
      baselineScore,
      candidateScore,
      delta,
      maxRegression,
      minImprovement,
    };
  }

  async ci(
    suite: string,
    options: {
      minScore?: number;
      maxLatencyMs?: number;
      baseline?: string;
      maxRegression?: number;
      repetitions?: number;
      timeoutMs?: number;
      runner?: EvalRunner;
    } = {},
  ): Promise<JsonObject> {
    const report = await this.run(suite, options);
    const reasons: string[] = [];
    if (report.score < (options.minScore ?? 0.9)) {
      reasons.push(`score ${report.score} below ${options.minScore ?? 0.9}`);
    }
    if (options.maxLatencyMs !== undefined && report.latencyMs > options.maxLatencyMs) {
      reasons.push(`latency ${report.latencyMs}ms above ${options.maxLatencyMs}ms`);
    }
    const comparison = options.baseline
      ? this.compare(options.baseline, report.reportPath, { maxRegression: options.maxRegression })
      : undefined;
    if (comparison && comparison.accepted !== true) {
      reasons.push("candidate regressed beyond the configured allowance");
    }
    return {
      accepted: reasons.length === 0,
      decision: reasons.length === 0 ? "accept" : "reject",
      reasons,
      report,
      comparison,
    };
  }

  importTraces(name = "real-trajectories", limit = 50, includeFailed = true): JsonObject {
    const cases: EvalCase[] = [];
    for (const row of this.traces.list({ limit })) {
      if (!includeFailed && row.status !== "completed") {
        continue;
      }
      const trace = this.traces.get(row.id);
      const prompt = typeof trace.metadata.prompt === "string" ? trace.metadata.prompt.trim() : "";
      if (!prompt) {
        continue;
      }
      const tools = new Set(
        (trace.events ?? [])
          .filter((event) => event.eventType === "after_tool_call")
          .map((event) =>
            typeof event.payload.toolName === "string" ? event.payload.toolName : "",
          )
          .filter(Boolean),
      );
      cases.push({
        id: `trace-${row.id}`,
        prompt,
        checks: [
          { type: "trace_status", value: "completed" },
          ...[...tools].map((tool) => ({ type: "tool_called", value: tool })),
        ],
        tags: ["real", "trajectory"],
        sourceTrace: row.id,
      });
    }
    if (cases.length === 0) {
      throw new Error("no reusable trace prompt was found");
    }
    const suite = safeName(name);
    const suitePath = path.join(this.root, "suites", `${suite}.jsonl`);
    fs.mkdirSync(path.dirname(suitePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(suitePath, `${cases.map((item) => JSON.stringify(item)).join("\n")}\n`, {
      mode: 0o600,
    });
    return { suite, path: suitePath, cases: cases.length };
  }

  status(): JsonObject {
    const suitesRoot = path.join(this.root, "suites");
    const runsRoot = path.join(this.root, "runs");
    const suites = fs.existsSync(suitesRoot)
      ? fs
          .readdirSync(suitesRoot)
          .filter((name) => name.endsWith(".jsonl"))
          .map((name) => path.join(suitesRoot, name))
      : [];
    const runs = fs.existsSync(runsRoot)
      ? fs
          .readdirSync(runsRoot)
          .filter((name) => name.endsWith(".json"))
          .map((name) => path.join(runsRoot, name))
          .toSorted((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      : [];
    return { suites, runCount: runs.length, latest: runs[0] ? loadJsonFile(runs[0]) : null };
  }
}
