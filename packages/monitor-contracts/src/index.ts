export const PROTOCOL_VERSION = 1 as const;
export type SourceStatus =
  "healthy" | "unavailable" | "stale" | "awaiting_instrumentation";
export interface Coverage {
  id: string;
  label: string;
  status: SourceStatus;
  observedAt: string | null;
  intervalMs: number;
  detail?: string;
}
export interface Metric {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  source: string;
}
export interface Service {
  id: string;
  name: string;
  state: string;
  detail?: string;
  pid?: number;
  restarts?: number;
}
export interface Disk {
  id: string;
  mount: string;
  device: string;
  uuid: string | null;
  bytes: number | null;
  free: number | null;
  inodesFree: number | null;
  expected: boolean;
  valid: boolean;
  readingError?: string;
}
export interface Schedule {
  id: string;
  name: string;
  source: string;
  expression: string;
  timezone: string;
  nextRun: string | null;
  lastRun: string | null;
  outcome: "unknown" | "running" | "success" | "failed" | "skipped";
  durationMs: number | null;
  missedSince?: string | null;
}
export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  level: string;
  message: string;
  traceId?: string;
}
export type Severity = "warning" | "critical";
export interface Incident {
  id: string;
  fingerprint: string;
  title: string;
  severity: Severity;
  state: "open" | "acknowledged" | "resolved";
  source: string;
  openedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  snoozedUntil: string | null;
  evidence: string[];
  analysis?: string;
}
export interface Queue {
  name: string;
  pending: number;
  running: number;
  failed: number;
  oldestReadySeconds: number | null;
}
export interface Usage {
  provider: string;
  requests: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  basis: "reported" | "estimated" | "unavailable";
  detail?: string;
}
export interface Snapshot {
  version: 1;
  generatedAt: string;
  hostname: string;
  metrics: Metric[];
  sources: Coverage[];
  disks: Disk[];
  services: Service[];
  schedules: Schedule[];
  queues: Queue[];
  usage: Usage[];
  incidents: Incident[];
  markers: { id: string; label: string; timestamp: string; detail: string }[];
}
export interface Series {
  key: string;
  points: [number, number][];
}
export type ProviderId = "codex" | "openai" | "grok" | "grok-cli";
export interface ProviderConnection {
  id: ProviderId;
  label: string;
  connected: boolean;
  status: string;
  models: string[];
  selectedModel: string | null;
  quota?: unknown;
  owner: string | null;
}
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  provider: ProviderId;
  status: "pending" | "complete" | "failed";
}
export interface MonitorSettings {
  automaticAi: boolean;
  defaultProvider: ProviderId;
  dailySummaryTime: string;
  timezone: string;
  monthlyBudgetUsd: number;
  thresholds: {
    diskFreeWarning: number;
    diskFreeCritical: number;
    queueWarningSeconds: number;
    queueCriticalSeconds: number;
    cpuWarningPercent: number;
    memoryAvailableWarningPercent: number;
  };
}
export interface Budget {
  month: string;
  limitUsd: number;
  spentUsd: number;
  reportedUsd: number;
  estimatedUsd: number;
  reservedUsd: number;
  automaticUsd: number;
  manualUsd: number;
}
export interface Principal {
  id: string;
  kind: "operator" | "superadmin";
  aiOwner: boolean;
}
export interface TelemetryEvent {
  version: 1;
  kind:
    "request" | "job" | "schedule" | "catalog" | "integration" | "heartbeat";
  timestamp: string;
  name?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number | null;
  outcome?: string;
  queue?: string;
  traceId?: string;
  schedules?: Schedule[];
}
export interface MonitorClient {
  request<T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T>;
  subscribe(
    onSnapshot: (snapshot: Snapshot) => void,
    onError: (message: string) => void,
    onAi?: (event: unknown) => void,
  ): () => void;
}
