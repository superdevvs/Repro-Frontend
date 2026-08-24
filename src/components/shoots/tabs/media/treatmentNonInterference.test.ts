import { describe, expect, it } from 'vitest';

import { groupMediaFilesByService, shouldShowServiceSections } from './mediaServiceGroups';
import { sortMediaFiles } from './mediaSort';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { ShootData } from '@/types/shoots';

/**
 * A treatment is a visible request, nothing more.
 *
 * These tests pin the negative half of that contract: adding `treatment` to a
 * file must not change which service section it lands in, how it sorts, or the
 * stack numbers it carries. The badge is a projection; if any of these start
 * reading `treatment`, the frame has effectively been reclassified again and
 * the whole point of the separate column is lost.
 */

const file = (overrides: Partial<MediaFile> & { id: string }): MediaFile =>
  ({
    filename: overrides.id + '.jpg',
    media_type: 'raw',
    ...overrides,
  }) as MediaFile;

const shoot = {
  id: 1,
  serviceItems: [
    { id: 112, service: { name: '10 Exterior HDR Photos' } },
    { id: 111, service: { name: '10-12 Drone Photos Package' } },
  ],
} as unknown as ShootData;

describe('treatment does not affect service subgrouping', () => {
  it('groups a treated frame under its booked service, exactly as an untreated one', () => {
    const treated = groupMediaFilesByService(
      [
        file({ id: 'a', shoot_service_id: 112, treatment: 'virtual_staging' } as never),
        file({ id: 'b', shoot_service_id: 112, treatment: 'twilight' } as never),
        file({ id: 'c', shoot_service_id: 111, treatment: 'green_grass' } as never),
      ],
      shoot,
    );
    const untreated = groupMediaFilesByService(
      [
        file({ id: 'a', shoot_service_id: 112 } as never),
        file({ id: 'b', shoot_service_id: 112 } as never),
        file({ id: 'c', shoot_service_id: 111 } as never),
      ],
      shoot,
    );

    const shape = (groups: ReturnType<typeof groupMediaFilesByService>) =>
      groups.map((g) => ({ serviceId: g.serviceId, ids: g.files.map((f) => f.id) }));

    expect(shape(treated)).toEqual(shape(untreated));
    expect(shouldShowServiceSections(treated)).toBe(shouldShowServiceSections(untreated));
  });

  it('does not divert a treated frame into an extras section', () => {
    const groups = groupMediaFilesByService(
      [file({ id: 'a', shoot_service_id: 112, treatment: 'green_grass' } as never)],
      shoot,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].isExtras).toBeFalsy();
    expect(groups[0].serviceId).toBe('112');
  });
});

describe('treatment does not affect sorting', () => {
  it('sorts identically whether or not treatments are present', () => {
    const withTreatments = [
      file({ id: 'IMG_003', filename: 'IMG_003.jpg', treatment: 'twilight' } as never),
      file({ id: 'IMG_001', filename: 'IMG_001.jpg', treatment: 'virtual_staging' } as never),
      file({ id: 'IMG_002', filename: 'IMG_002.jpg', treatment: 'green_grass' } as never),
    ];
    const without = [
      file({ id: 'IMG_003', filename: 'IMG_003.jpg' }),
      file({ id: 'IMG_001', filename: 'IMG_001.jpg' }),
      file({ id: 'IMG_002', filename: 'IMG_002.jpg' }),
    ];

    const ids = (files: MediaFile[]) => sortMediaFiles(files, 'name').map((f) => f.id);

    expect(ids(withTreatments)).toEqual(ids(without));
    expect(ids(withTreatments)).toEqual(['IMG_001', 'IMG_002', 'IMG_003']);
  });
});

describe('treatment does not affect stack numbers or identity', () => {
  it('carries bracket_group and sequence through untouched', () => {
    const files = [
      file({ id: 'a', shoot_service_id: 112, bracket_group: 1, sequence: 1, treatment: 'virtual_staging' } as never),
      file({ id: 'b', shoot_service_id: 112, bracket_group: 1, sequence: 2, treatment: 'twilight' } as never),
      file({ id: 'c', shoot_service_id: 111, bracket_group: undefined, sequence: undefined, treatment: 'green_grass' } as never),
    ];

    const grouped = groupMediaFilesByService(files, shoot).flatMap((g) => g.files);

    expect(grouped.find((f) => f.id === 'a')?.bracket_group).toBe(1);
    expect(grouped.find((f) => f.id === 'a')?.sequence).toBe(1);
    expect(grouped.find((f) => f.id === 'b')?.sequence).toBe(2);
    // Non-bracketed work stays non-bracketed regardless of its treatment.
    expect(grouped.find((f) => f.id === 'c')?.bracket_group).toBeUndefined();
  });

  it('preserves file ids, which is what selection is keyed on', () => {
    const files = [
      file({ id: 'sel-1', shoot_service_id: 112, treatment: 'virtual_staging' } as never),
      file({ id: 'sel-2', shoot_service_id: 111, treatment: 'green_grass' } as never),
    ];

    const ids = groupMediaFilesByService(files, shoot)
      .flatMap((g) => g.files)
      .map((f) => f.id)
      .sort();

    expect(ids).toEqual(['sel-1', 'sel-2']);
  });

  it('leaves media_type alone, which is what tab routing reads', () => {
    // The Photos tab filter keys on media_type. As long as a treated frame is
    // still 'raw', it cannot be diverted into a separate VS/GG/TW tab.
    const files = [
      file({ id: 'a', treatment: 'virtual_staging' } as never),
      file({ id: 'b', treatment: 'green_grass' } as never),
      file({ id: 'c', treatment: 'twilight' } as never),
    ];

    files.forEach((f) => expect(f.media_type).toBe('raw'));
  });
});
