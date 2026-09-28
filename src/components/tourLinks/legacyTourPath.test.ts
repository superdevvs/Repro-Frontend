import { describe, expect, it } from 'vitest';
import { legacyTourQuery, parseLegacyTourPath } from './legacyTourPath';

describe('old tour paths', () => {
  it('keeps source IDs separate from new dashboard IDs and accepts both old slug styles', () => {
    for (const slug of ['105WestwickCourt_Countryside_VA_20165', '105_Westwick_Court_Countryside_VA_20165']) {
      const identity = parseLegacyTourPath(`/tour/${slug}_1626_466078.html`);
      expect(identity).toEqual({ companyId: '1626', sourceId: '466078', audience: 'branded' });
      expect(legacyTourQuery(identity!)).toBe('legacyCompanyId=1626&legacyShootId=466078');
    }
  });
  it('keeps MLS and branded audiences distinct', () => {
    expect(parseLegacyTourPath('/tour/MLS/Home_1626_466078.html')?.audience).toBe('mls');
    expect(parseLegacyTourPath('/tour/Home_1626_466078.html')?.audience).toBe('branded');
  });
  it('does not reinterpret canonical routes, login pages or malformed paths', () => {
    for (const path of ['/tour/branded', '/tour/mls', '/login/', '/tour/Home_1626_466078.html/other', '/tour/MLS/nested/Home_1626_466078.html', '/tour/Home_bad_466078.html']) {
      expect(parseLegacyTourPath(path)).toBeNull();
    }
  });
});
