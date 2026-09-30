import { flattenCatalogPages } from './catalog';

const label = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const request = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//.exec(value);
  if (request) return `${request[1]} API request`;
  return /^[A-Za-z0-9_/. :{}-]{1,160}$/.test(value) ? value : undefined;
};

export const telemetryRoute = (value: string): string => {
  const path = value.split(/[?#]/, 1)[0] || '/';
  const pages = flattenCatalogPages().sort((a, b) => b.route.length - a.route.length);
  return pages.find((page) => {
    const prefix = page.route.split('/:')[0];
    return path === page.route || path === prefix || (prefix !== '/' && path.startsWith(`${prefix}/`));
  })?.route ?? '/unmatched';
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR_KIND_RE = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const API_CODE_RE = /^[a-z][a-z0-9_]{0,79}$/;
const HTTP_METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i;
/** Path-only API routes; strips query/fragment and rejects non-/api shapes. */
const safeApiPath = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const path = value.split(/[?#]/, 1)[0];
  if (!/^\/api\/[A-Za-z0-9/_\-.]{0,200}$/.test(path)) return undefined;
  return path;
};

/** An explicit telemetry schema, never a serialized API error or request object. */
export function telemetryPayload(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const safe: Record<string, unknown> = {};
  if (typeof payload.statusCode === 'number' && Number.isInteger(payload.statusCode) && payload.statusCode >= 100 && payload.statusCode <= 599) {
    safe.statusCode = payload.statusCode;
  }
  if (typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs) && payload.durationMs >= 0) {
    safe.durationMs = Math.min(payload.durationMs, 86400000);
  }
  if (typeof payload.code === 'string' && API_CODE_RE.test(payload.code)) safe.code = payload.code;
  // Privacy-safe error kind (e.g. ApiError / FetchError) — distinct from forced top-level errorClass.
  const kind = payload.kind ?? payload.errorKind;
  if (typeof kind === 'string' && ERROR_KIND_RE.test(kind)) safe.kind = kind;
  if (typeof payload.requestId === 'string' && UUID_RE.test(payload.requestId)) safe.requestId = payload.requestId;
  if (typeof payload.method === 'string' && HTTP_METHOD_RE.test(payload.method)) {
    safe.method = payload.method.toUpperCase();
  }
  const path = safeApiPath(payload.path);
  if (path) safe.path = path;
  return Object.keys(safe).length ? safe : undefined;
}

export const telemetryLabel = label;
