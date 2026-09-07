import { describe, expect, it } from 'vitest';
import { buildShootZipFilename, getShootDownloadAddress, parseDownloadFilename } from './shootDownloadFilename';

describe('property download filenames', () => {
  it('uses property and locality across shoot and dashboard models', () => {
    expect(getShootDownloadAddress({ location: { address: '12 Oak Street', city: 'Austin', state: 'TX', zip: '78701' } })).toBe('12 Oak Street, Austin, TX, 78701');
    expect(getShootDownloadAddress({ addressLine: '12 Oak Street', cityStateZip: 'Austin, TX 78701' })).toBe('12 Oak Street, Austin, TX 78701');
    expect(getShootDownloadAddress({ location: { fullAddress: '12 Oak Street, Austin, TX 78701', city: 'Austin' } })).toBe('12 Oak Street, Austin, TX 78701');
  });

  it('produces a safe bounded ZIP name and handles missing property metadata', () => {
    expect(buildShootZipFilename('12 Oák Street, Austin TX', 'raw-files', 63)).toBe('12-oak-street-austin-tx-raw-files.zip');
    expect(buildShootZipFilename('', 'selected-mls', 63)).toBe('shoot-63-selected-mls.zip');
    expect(buildShootZipFilename('../' + 'A'.repeat(400), 'selected-print')).toHaveLength(199);
  });

  it('prefers encoded names and safely falls back on malformed disposition', () => {
    expect(parseDownloadFilename("attachment; filename=old.zip; filename*=UTF-8''12%20Oak.zip")).toBe('12 Oak.zip');
    expect(parseDownloadFilename("attachment; filename=12-oak.zip; filename*=UTF-8''%zz; size=10")).toBe('12-oak.zip');
    expect(parseDownloadFilename('attachment; filename="../12-oak.zip"')).toBe('12-oak.zip');
    expect(parseDownloadFilename(`attachment; filename="12${String.fromCharCode(0)}oak.zip"`)).toBe('12-oak.zip');
    expect(parseDownloadFilename(null)).toBeNull();
  });
});
