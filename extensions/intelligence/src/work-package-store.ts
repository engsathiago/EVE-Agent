import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "eve-agent/plugin-sdk/state-paths";
import YAML from "yaml";
import type { EvalSuiteService } from "./eval-suite.js";
import type { FlowStore } from "./flow-store.js";
import type {
  EveFlowDefinition,
  EveFlowStepDefinition,
  EveWorkPackageManifest,
  JsonObject,
} from "./types.js";

type PackageDocument = {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  recommendedSkills?: unknown;
  recommended_skills?: unknown;
};

type FileSnapshot = {
  target: string;
  backup: string;
  existed: boolean;
};

type InstallationReceipt = {
  flows?: unknown;
  evals?: unknown;
  skills?: unknown;
};

function safeName(value: string): string {
  const name = value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  if (!name) {
    throw new Error("invalid package name");
  }
  return name;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
    : [];
}

function containedPaths(root: string, value: unknown): string[] {
  return strings(value).filter((candidate) => {
    const relative = path.relative(root, candidate);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
  });
}

function receiptFlowNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }
    const name = (entry as { name?: unknown }).name;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  });
}

function readManifest(directory: string): EveWorkPackageManifest {
  const candidates = ["eve-package.yaml", "eve-package.yml"];
  const manifestPath = candidates.map((name) => path.join(directory, name)).find(fs.existsSync);
  if (!manifestPath) {
    throw new Error("work package requires eve-package.yaml");
  }
  const data = YAML.parse(fs.readFileSync(manifestPath, "utf8")) as PackageDocument;
  if (!data || typeof data.name !== "string" || typeof data.version !== "string") {
    throw new Error("work package manifest requires name and version");
  }
  return {
    name: safeName(data.name),
    version: data.version.trim(),
    description: typeof data.description === "string" ? data.description : "",
    recommendedSkills: strings(data.recommendedSkills ?? data.recommended_skills),
  };
}

function assertNoSymlinks(root: string): void {
  if (fs.lstatSync(root).isSymbolicLink()) {
    throw new Error(`work package symbolic links are not allowed: ${root}`);
  }
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`work package symbolic links are not allowed: ${absolute}`);
      }
      if (entry.isDirectory()) {
        walk(absolute);
      }
    }
  };
  walk(root);
}

function digestTree(directory: string): string {
  const hash = createHash("sha256");
  const walk = (current: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .toSorted((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const absolute = path.join(current, entry.name);
      const relative = path.relative(directory, absolute);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        hash.update(relative);
        hash.update(fs.readFileSync(absolute));
      }
    }
  };
  walk(directory);
  return hash.digest("hex");
}

function parseFlow(flowPath: string): EveFlowDefinition {
  const document = YAML.parse(fs.readFileSync(flowPath, "utf8")) as Record<string, unknown>;
  if (!document || typeof document.name !== "string" || !Array.isArray(document.steps)) {
    throw new Error(`invalid flow in package: ${flowPath}`);
  }
  const steps = document.steps.map((raw, index): EveFlowStepDefinition => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`invalid step ${index + 1} in ${flowPath}`);
    }
    const step = raw as Record<string, unknown>;
    if (typeof step.id !== "string" || typeof step.type !== "string") {
      throw new Error(`flow step ${index + 1} requires id and type`);
    }
    const type = step.type === "eve" || step.type === "athena" ? "agent" : step.type;
    if (!["value", "wait", "agent", "command"].includes(type)) {
      throw new Error(`unsupported flow step type: ${type}`);
    }
    return {
      ...step,
      id: step.id,
      type: type as EveFlowStepDefinition["type"],
      ...(typeof step.message === "string"
        ? { metadata: { ...(step.metadata as JsonObject | undefined), message: step.message } }
        : {}),
    } as EveFlowStepDefinition;
  });
  return {
    name: document.name,
    description: typeof document.description === "string" ? document.description : undefined,
    version: typeof document.version === "number" ? document.version : undefined,
    steps,
  };
}

export class WorkPackageStore {
  readonly installedRoot: string;
  readonly stateDir: string;

  constructor(
    private readonly flows: FlowStore,
    private readonly evals: EvalSuiteService,
    readonly builtinRoot: string,
    stateDir = resolveStateDir(),
  ) {
    this.stateDir = stateDir;
    this.installedRoot = path.join(stateDir, "packages");
  }

  private snapshotTargets(targets: string[], rollbackRoot: string): FileSnapshot[] {
    return [...new Set(targets)].map((target, index) => {
      const backup = path.join(rollbackRoot, String(index));
      const stat = fs.statSync(target, { throwIfNoEntry: false });
      if (stat) {
        fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
        fs.cpSync(target, backup, { recursive: stat.isDirectory(), dereference: true });
      }
      return { target, backup, existed: Boolean(stat) };
    });
  }

  private restoreSnapshots(snapshots: FileSnapshot[]): void {
    for (const snapshot of snapshots.toReversed()) {
      fs.rmSync(snapshot.target, { recursive: true, force: true });
      if (!snapshot.existed) {
        continue;
      }
      const stat = fs.statSync(snapshot.backup);
      fs.mkdirSync(path.dirname(snapshot.target), { recursive: true, mode: 0o700 });
      fs.cpSync(snapshot.backup, snapshot.target, {
        recursive: stat.isDirectory(),
        dereference: true,
      });
    }
  }

  private readReceipt(target: string): InstallationReceipt {
    const receiptPath = path.join(target, "installation.json");
    if (!fs.existsSync(receiptPath)) {
      return {};
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(receiptPath, "utf8")) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as InstallationReceipt)
        : {};
    } catch {
      return {};
    }
  }

  private resolve(source: string): string {
    const direct = path.resolve(source);
    if (fs.statSync(direct, { throwIfNoEntry: false })?.isDirectory()) {
      return direct;
    }
    const builtin = path.join(this.builtinRoot, safeName(source));
    if (fs.statSync(builtin, { throwIfNoEntry: false })?.isDirectory()) {
      return builtin;
    }
    throw new Error(`work package not found: ${source}`);
  }

  list(): JsonObject {
    const available = fs.statSync(this.builtinRoot, { throwIfNoEntry: false })?.isDirectory()
      ? fs
          .readdirSync(this.builtinRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .flatMap((entry) => {
            const directory = path.join(this.builtinRoot, entry.name);
            try {
              return [{ ...readManifest(directory), path: directory }];
            } catch {
              return [];
            }
          })
      : [];
    const installed = fs.statSync(this.installedRoot, { throwIfNoEntry: false })?.isDirectory()
      ? fs
          .readdirSync(this.installedRoot, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() &&
              !entry.name.startsWith(".") &&
              !entry.name.endsWith(".previous"),
          )
          .flatMap((entry) => {
            const receipt = path.join(this.installedRoot, entry.name, "installation.json");
            try {
              return [JSON.parse(fs.readFileSync(receipt, "utf8")) as JsonObject];
            } catch {
              return [];
            }
          })
      : [];
    return { available, installed };
  }

  install(source: string, force = false): JsonObject {
    const directory = this.resolve(source);
    assertNoSymlinks(directory);
    const manifest = readManifest(directory);
    const target = path.join(this.installedRoot, manifest.name);
    if (fs.existsSync(target) && !force) {
      throw new Error(`package already installed: ${manifest.name}`);
    }
    const previousReceipt = force ? this.readReceipt(target) : {};

    const flowRoot = path.join(directory, "flows");
    const flowFiles = fs.statSync(flowRoot, { throwIfNoEntry: false })?.isDirectory()
      ? fs
          .readdirSync(flowRoot)
          .filter((name) => /\.ya?ml$/i.test(name))
          .map((name) => path.join(flowRoot, name))
      : [];
    const definitions = flowFiles.map(parseFlow);
    const evalRoot = path.join(directory, "evals");
    const evalFiles = fs.statSync(evalRoot, { throwIfNoEntry: false })?.isDirectory()
      ? fs
          .readdirSync(evalRoot)
          .filter((name) => name.endsWith(".jsonl"))
          .map((name) => path.join(evalRoot, name))
      : [];
    for (const file of evalFiles) {
      this.evals.load(file);
    }

    const evalPlan = evalFiles.map((file) => ({
      source: file,
      destination: path.join(this.evals.root, "suites", `${manifest.name}-${path.basename(file)}`),
    }));
    const skillsRoot = path.join(directory, "skills");
    const destinationSkillsRoot = path.join(this.stateDir, "skills");
    const skillPlan = fs.statSync(skillsRoot, { throwIfNoEntry: false })?.isDirectory()
      ? fs
          .readdirSync(skillsRoot, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, "SKILL.md")),
          )
          .map((entry) => ({
            source: path.join(skillsRoot, entry.name),
            destination: path.join(destinationSkillsRoot, safeName(entry.name)),
          }))
          .filter((entry) => force || !fs.existsSync(entry.destination))
      : [];
    const evalsRoot = path.join(this.evals.root, "suites");
    const previousEvals = containedPaths(evalsRoot, previousReceipt.evals);
    const previousSkills = containedPaths(destinationSkillsRoot, previousReceipt.skills);
    const currentEvals = new Set(evalPlan.map((entry) => entry.destination));
    const currentSkills = new Set(skillPlan.map((entry) => entry.destination));
    const staleEvals = previousEvals.filter((entry) => !currentEvals.has(entry));
    const staleSkills = previousSkills.filter((entry) => !currentSkills.has(entry));
    const currentFlowNames = new Set(definitions.map((definition) => definition.name.trim()));
    const staleFlowNames = receiptFlowNames(previousReceipt.flows).filter(
      (name) => !currentFlowNames.has(name),
    );

    fs.mkdirSync(this.installedRoot, { recursive: true, mode: 0o700 });
    const staging = path.join(this.installedRoot, `.${manifest.name}.staging-${process.pid}`);
    const rollbackRoot = path.join(
      this.installedRoot,
      `.${manifest.name}.rollback-${process.pid}-${Date.now()}`,
    );
    fs.rmSync(staging, { recursive: true, force: true });
    fs.cpSync(directory, staging, { recursive: true, dereference: true, errorOnExist: false });
    const previous = `${target}.previous`;
    fs.mkdirSync(rollbackRoot, { recursive: true, mode: 0o700 });
    const snapshots = this.snapshotTargets(
      [
        target,
        previous,
        ...evalPlan.map((entry) => entry.destination),
        ...skillPlan.map((entry) => entry.destination),
        ...staleEvals,
        ...staleSkills,
      ],
      rollbackRoot,
    );
    this.flows.db.exec("BEGIN IMMEDIATE");
    let committed = false;
    try {
      for (const name of staleFlowNames) {
        this.flows.remove(name);
      }
      const installedFlows = definitions.map((definition) => this.flows.install(definition));
      const installedEvals: string[] = [];
      fs.mkdirSync(path.join(this.evals.root, "suites"), { recursive: true, mode: 0o700 });
      for (const entry of evalPlan) {
        fs.copyFileSync(entry.source, entry.destination);
        fs.chmodSync(entry.destination, 0o600);
        installedEvals.push(entry.destination);
      }

      const installedSkills: string[] = [];
      fs.mkdirSync(destinationSkillsRoot, { recursive: true, mode: 0o700 });
      for (const entry of skillPlan) {
        fs.rmSync(entry.destination, { recursive: true, force: true });
        fs.cpSync(entry.source, entry.destination, { recursive: true, dereference: true });
        installedSkills.push(entry.destination);
      }
      for (const entry of staleEvals) {
        fs.rmSync(entry, { force: true });
      }
      for (const entry of staleSkills) {
        fs.rmSync(entry, { recursive: true, force: true });
      }

      const receipt: JsonObject = {
        ...manifest,
        digest: digestTree(staging),
        source: directory,
        installedAt: Date.now(),
        flows: installedFlows,
        evals: installedEvals,
        skills: installedSkills,
      };
      fs.writeFileSync(path.join(staging, "installation.json"), JSON.stringify(receipt, null, 2), {
        mode: 0o600,
      });
      fs.rmSync(previous, { recursive: true, force: true });
      if (fs.existsSync(target)) {
        fs.renameSync(target, previous);
      }
      fs.renameSync(staging, target);
      this.flows.db.exec("COMMIT");
      committed = true;
      try {
        fs.rmSync(previous, { recursive: true, force: true });
        fs.rmSync(rollbackRoot, { recursive: true, force: true });
      } catch {}
      return receipt;
    } catch (error) {
      if (committed) {
        throw error;
      }
      try {
        this.flows.db.exec("ROLLBACK");
      } catch {}
      this.restoreSnapshots(snapshots);
      fs.rmSync(staging, { recursive: true, force: true });
      fs.rmSync(rollbackRoot, { recursive: true, force: true });
      throw error;
    }
  }
}
