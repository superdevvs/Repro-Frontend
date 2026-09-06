import { describe, expect, it } from 'vitest';
import { telemetryLabel, telemetryPayload, telemetryRoute } from './telemetryPrivacy';

describe('telemetry privacy', () => {
  it('allows only operational numbers and reviewed code syntax, dropping error/config/body objects', () => {
    const sensitive = { password: 'secret-canary', headers: { Authorization: 'Bearer secret-canary' } };
    const circular: Record<string, unknown> = { self: null }; circular.self = circular;
    expect(telemetryPayload({ statusCode: 503, durationMs: 200, code: 'service_unavailable', error: sensitive, data: circular }))
      .toEqual({ statusCode: 503, durationMs: 200, code: 'service_unavailable' });
    expect(telemetryPayload({ message: 'secret-canary', response: sensitive })).toBeUndefined();
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
