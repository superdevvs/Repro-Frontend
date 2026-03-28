export type SystemNodeKind = 'domain' | 'page' | 'component' | 'api' | 'service' | 'external';

export interface TelemetryPayloadSummary {
  topLevelKeys: string[];
  keyCount: number;
  byteSize: number;
  preview?: string | null;
  sanitized?: unknown;
}

export interface RouteTraceSummary {
  traceId: string;
  sessionKey?: string | null;
  userId?: string | number | null;
  domain?: string | null;
  routeName?: string | null;
  method: string;
  path: string;
  currentRoute?: string | null;
  controllerAction?: string | null;
  statusCode?: number | null;
  durationMs: number;
  requestBytes?: number;
  responseBytes?: number;
  blockerType?: string | null;
  blockerMessage?: string | null;
  errorClass?: string | null;
  requestPayloadSummary?: TelemetryPayloadSummary | null;
  responsePayloadSummary?: TelemetryPayloadSummary | null;
  occurredAt?: string | null;
}

export interface BlockerEvent {
  sessionKey?: string | null;
  userId?: string | number | null;
  traceId?: string | null;
  source: 'frontend' | 'backend';
  severity?: string | null;
  routePath?: string | null;
  componentName?: string | null;
  blockerType?: string | null;
  errorClass?: string | null;
  message: string;
  contextSummary?: TelemetryPayloadSummary | Record<string, unknown> | null;
  occurredAt?: string | null;
}

export interface LiveUserActivity {
  sessionKey: string;
  userId?: string | number | null;
  userName?: string | null;
  userRole?: string | null;
  currentRoute?: string | null;
  currentPage?: string | null;
  currentAction?: string | null;
  componentStack?: string[];
  blockerState?: string | null;
  blockerMessage?: string | null;
  lastApiPath?: string | null;
  lastTraceId?: string | null;
  lastActivityAt?: string | null;
}

export interface SystemNode {
  id: string;
  kind: SystemNodeKind;
  domain: string;
  label: string;
  description?: string;
  routePath?: string;
  componentName?: string;
  apiPath?: string;
  controllerAction?: string;
  serviceName?: string;
  externalName?: string;
  activeUsers?: number;
  requests?: number;
  errors?: number;
  avgDurationMs?: number;
}

export interface SystemEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface SystemDomainStats {
  activeUsers: number;
  requests: number;
  errors: number;
  avgDurationMs: number;
}

export interface SystemSnapshot {
  generatedAt: string;
  stats: {
    activeSessions: number;
    requestsPerMinute: number;
    errorCount24h: number;
    slowRouteCount: number;
    integrationFailures24h: number;
  };
  domainStats: Record<string, SystemDomainStats>;
  liveUsers: LiveUserActivity[];
  routeMetrics: Array<{
    path: string;
    domain?: string | null;
    requestCount: number;
    errorCount: number;
    avgDurationMs: number;
    maxDurationMs: number;
    lastStatusCode?: number | null;
    lastSeenAt?: string | null;
  }>;
  recentTraces: RouteTraceSummary[];
  recentErrors: BlockerEvent[];
}

export interface SystemHistoryPoint {
  bucketStart: string;
  bucketEnd: string;
  requests: number;
  errors: number;
  activeSessions: number;
  avgDurationMs: number;
}

export interface SystemHistory {
  window: string;
  timeline: SystemHistoryPoint[];
}

export interface SystemOverviewResourceResponse<T> {
  data: T;
  telemetryAvailable: boolean;
}

export interface SystemOverviewUnavailableError {
  message: string;
  code: 'system_overview_unavailable';
  telemetryAvailable: false;
}

export interface SystemRouteCatalogEntry {
  methods: string[];
  path: string;
  name?: string | null;
  domain: string;
  controllerAction?: string | null;
  middleware: string[];
  metrics?: SystemSnapshot['routeMetrics'][number] | null;
}

export interface SystemTraceDetail {
  trace: RouteTraceSummary;
  session: LiveUserActivity | null;
  errors: BlockerEvent[];
  recentEvents: Array<{
    type: string;
    routePath?: string | null;
    pageKey?: string | null;
    componentName?: string | null;
    actionName?: string | null;
    severity?: string | null;
    payloadSummary?: TelemetryPayloadSummary | null;
    occurredAt?: string | null;
  }>;
}
