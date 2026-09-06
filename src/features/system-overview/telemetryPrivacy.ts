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
  if (typeof payload.code === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(payload.code)) safe.code = payload.code;
  return Object.keys(safe).length ? safe : undefined;
}

export const telemetryLabel = label;
