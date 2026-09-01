import { describe, expect, it } from 'vitest';
import { normalizeShootCompReshootFields } from './normalizeShootCompReshoot';

describe('shoot complimentary reshoot normalization', () => {
  it('preserves original-shoot child details and the exact affected-item mapping contract', () => {
    const normalized = normalizeShootCompReshootFields({
      complimentary_reshoots: [{
        id: 77,
        scheduled_date: '2026-09-12',
        full_address: '10 Main Street, Leesburg, VA 20175',
        reason_code: 'missed_area',
        affected_service_names: ['Interior photos'],
      }],
      affected_source_items: [{
        shoot_service_id: 701,
        source_shoot_service_id: 501,
        source_service: { id: 17, name: 'Original interior photos' },
        reason_code: 'missed_area',
        responsibility: 'photographer',
      }],
    });

    expect(normalized.reshootChildren[0]).toMatchObject({
      id: '77',
      scheduledDate: '2026-09-12',
      reasonCode: 'missed_area',
      affectedServiceNames: ['Interior photos'],
    });
    expect(normalized.reshootServiceLinks[0]).toMatchObject({
      reshootShootServiceId: 701,
      sourceShootServiceId: 501,
      sourceServiceName: 'Original interior photos',
    });
  });
});
