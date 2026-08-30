export type JsonObject = Record<string, unknown>;

export type EveTraceStatus = "running" | "completed" | "failed" | "interrupted" | "closed";

export type EveTraceEvent = {
  id: number;
  runId: string;
  eventType: string;
  spanKey: string;
  parentSpanKey: string;
  occurredAt: number;
  durationMs: number;
  status: string;
  payload: JsonObject;
};

export type EveTraceRun = {
  id: string;
  runKey: string;
  sessionId: string;
  sessionKey: string;
  agentId: string;
  platform: string;
  model: string;
  provider: string;
  status: EveTraceStatus;
  startedAt: number;
  endedAt?: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  modelCalls: number;
  toolCalls: number;
  retries: number;
  errorCount: number;
  summary: string;
  metadata: JsonObject;
  events?: EveTraceEvent[];
  durationMs?: number;
};

export type EveResultStatus = "ready" | "approved" | "changes_requested" | "failed" | "archived";

export type EveResultArtifact = {
  id: string;
  itemId: string;
  name: string;
  path: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  version: number;
  createdAt: number;
};

export type EveResultItem = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  summary: string;
  status: EveResultStatus;
  createdAt: number;
  updatedAt: number;
  metadata: JsonObject;
  artifacts?: EveResultArtifact[];
};

export type EveFlowStepDefinition = {
  id: string;
  type: "value" | "wait" | "agent" | "command";
  needs?: string[];
  when?: unknown;
  value?: unknown;
  prompt?: string;
  command?: string | string[];
  cwd?: string;
  retries?: number;
  metadata?: JsonObject;
};

export type EveFlowDefinition = {
  id?: string;
  name: string;
  description?: string;
  version?: number;
  steps: EveFlowStepDefinition[];
};

export type EveFlowStepRun = {
  stepId: string;
  status: "pending" | "running" | "waiting" | "completed" | "failed" | "skipped";
  attempt: number;
  startedAt?: number;
  endedAt?: number;
  input: JsonObject;
  output: JsonObject;
  error: string;
  checkpoint: JsonObject;
};

export type EveFlowRun = {
  id: string;
  flowId: string;
  flowName: string;
  flowVersion: number;
  status: "pending" | "running" | "waiting" | "completed" | "failed";
  input: JsonObject;
  output: JsonObject;
  error: string;
  parentRunId: string;
  createdAt: number;
  updatedAt: number;
  steps: EveFlowStepRun[];
};

export type EveRouteObservation = {
  taskKind: string;
  model: string;
  provider?: string;
  success: boolean;
  quality?: number;
  latencyMs?: number;
  costUsd?: number;
  toolSuccess?: number;
  metadata?: JsonObject;
};

export type EveRouteCandidate = {
  model: string;
  provider?: string;
  tasks?: string[];
  expectedLatencyMs?: number;
  expectedCostUsd?: number;
};

export type EveRouteDecision = {
  taskKind: string;
  model: string;
  provider: string;
  score: number;
  reason: string;
  candidates: Array<{ model: string; provider: string; score: number; samples: number }>;
  experiment?: { id: string; name: string; arm: "baseline" | "candidate" };
};

export type EveExperimentStatus = "draft" | "running" | "promoted" | "stopped";

export type EveExperiment = {
  id: string;
  name: string;
  kind: string;
  baseline: string;
  candidate: string;
  trafficPercent: number;
  status: EveExperimentStatus;
  minSamples: number;
  maxRegression: number;
  baselineRuns: number;
  candidateRuns: number;
  baselineScore: number;
  candidateScore: number;
  decision: "collect" | "promote" | "stop";
  createdAt: number;
  updatedAt: number;
  metadata: JsonObject;
};

export type EveWorkerNode = {
  id: string;
  name: string;
  endpoint: string;
  labels: string[];
  capabilities: string[];
  status: "online" | "offline" | "busy";
  lastHeartbeat: number;
  activeJobs: number;
  maxJobs: number;
  metadata: JsonObject;
};

export type EveWorkerJob = {
  id: string;
  kind: string;
  payload: JsonObject;
  requirements: string[];
  status: "queued" | "leased" | "completed" | "failed";
  priority: number;
  workerId: string;
  leaseUntil: number;
  attempts: number;
  maxAttempts: number;
  result: JsonObject;
  error: string;
  createdAt: number;
  updatedAt: number;
};

export type EveEnvironmentSnapshot = {
  image: string;
  createdAt: number;
};

export type EveManagedEnvironment = {
  id: string;
  name: string;
  backend: "docker";
  containerId: string;
  containerName: string;
  image: string;
  status: "creating" | "running" | "paused" | "stopped" | "expired" | "missing" | "failed";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  ttlMinutes: number;
  cpu: number;
  memoryMb: number;
  persistent: boolean;
  network: boolean;
  workspace: string;
  exitCode?: number;
  runtimeError: string;
  expired: boolean;
  snapshots: EveEnvironmentSnapshot[];
};

export type EveStudioPreviewKind =
  | "html"
  | "markdown"
  | "csv"
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "text"
  | "download";

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
  previewKind: EveStudioPreviewKind;
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

export type EveWorkPackageManifest = {
  name: string;
  version: string;
  description: string;
  recommendedSkills: string[];
};
