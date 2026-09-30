import { describe, expect, it } from 'vitest';
import { findCatalogPageByRoute } from './catalog';
import { telemetryLabel, telemetryPayload, telemetryRoute } from './telemetryPrivacy';

describe('telemetry privacy', () => {
  it('allows only operational numbers and reviewed code syntax, dropping error/config/body objects', () => {
    const sensitive = { password: 'secret-canary', headers: { Authorization: 'Bearer secret-canary' } };
    const circular: Record<string, unknown> = { self: null }; circular.self = circular;
    const requestId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(telemetryPayload({
      statusCode: 503,
      durationMs: 200,
      code: 'service_unavailable',
      kind: 'ApiError',
      requestId,
      method: 'get',
      path: '/api/shoots/pending-reschedules?token=secret-canary',
      error: sensitive,
      data: circular,
    })).toEqual({
      statusCode: 503,
      durationMs: 200,
      code: 'service_unavailable',
      kind: 'ApiError',
      requestId,
      method: 'GET',
      path: '/api/shoots/pending-reschedules',
    });
    expect(telemetryPayload({ message: 'secret-canary', response: sensitive })).toBeUndefined();
    expect(telemetryPayload({ path: '/private/secret', requestId: 'not-a-uuid', kind: 'bad kind!' })).toBeUndefined();
  });
  it('removes query strings and fragments and rejects free-form labels', () => {
    expect(telemetryRoute('/settings?token=secret-canary#secret')).toBe('/settings');
    expect(telemetryRoute('/shoots/secret-canary')).toBe('/shoots/:id');
    expect(telemetryRoute('/private-token/secret-canary')).toBe('/unmatched');
    expect(telemetryLabel('GET /api/reset-password/secret-canary')).toBe('GET API request');
    expect(telemetryLabel('Error: password=secret-canary')).toBeUndefined();
    expect(telemetryLabel('SystemOverviewTab')).toBe('SystemOverviewTab');
  });
});

describe('findCatalogPageByRoute', () => {
  it('does not label every path as auth-login because catalog route `/` is exact-only', () => {
    expect(findCatalogPageByRoute('/')?.pageKey).toBe('auth-login');
    expect(findCatalogPageByRoute('/dashboard')?.pageKey).toBe('dashboard');
    expect(findCatalogPageByRoute('/settings')?.pageKey).toBe('settings');
    expect(findCatalogPageByRoute('/shoots/42')?.pageKey).toBe('shoot-detail');
    expect(findCatalogPageByRoute('/messaging/sms')?.pageKey).toBe('messaging-sms');
    expect(findCatalogPageByRoute('/unknown-surface')?.pageKey).toBeUndefined();
  });

  it('prefers the longest matching catalog route', () => {
    expect(findCatalogPageByRoute('/messaging/email/automations')?.pageKey).toBe('messaging-automations');
    expect(findCatalogPageByRoute('/messaging')?.pageKey).toBe('messaging-overview');
  });
});
