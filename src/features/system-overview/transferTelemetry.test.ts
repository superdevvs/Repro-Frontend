import { describe, expect, it } from 'vitest';
import { sanitizeTransferTelemetry, type TransferTelemetry } from './transferTelemetry';

const valid: TransferTelemetry = { direction: 'upload', mediaType: 'raw', bytes: 1024, transferMs: 200, confirmationMs: 50, totalMs: 250, status: 200, outcome: 'confirmed', chunked: false };

describe('transfer telemetry privacy and numeric validation', () => {
  it('keeps measurements and strips arbitrary metadata', () => {
    expect(sanitizeTransferTelemetry({ ...valid, filename: 'private.jpg', url: '?signature=secret' } as TransferTelemetry)).toEqual(valid);
  });
  it.each([NaN, Infinity, -1, 86_400_001])('rejects invalid durations %s', (totalMs) => {
    expect(sanitizeTransferTelemetry({ ...valid, totalMs })).toBeUndefined();
  });
  it('preserves unavailable timing as null', () => {
    expect(sanitizeTransferTelemetry({ ...valid, transferMs: null, confirmationMs: null })).toMatchObject({ transferMs: null, confirmationMs: null });
  });
});
