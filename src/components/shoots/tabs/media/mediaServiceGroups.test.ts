import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import {
  buildServiceLabelMap,
  groupMediaFilesByService,
  shouldShowServiceSections,
} from './mediaServiceGroups';

const shoot = {
  id: '1',
  serviceItems: [
    { shoot_service_id: '101', name: 'Exterior HDR' },
    { shoot_service_id: '102', name: 'Interior HDR' },
    { shoot_service_id: '103', name: 'Drone Photos' },
  ],
} as unknown as ShootData;

const file = (id: string, serviceId: string | null, extra = false): MediaFile => ({
  id,
  shoot_service_id: serviceId,
  isExtra: extra,
  media_type: extra ? 'extra' : 'raw',
} as unknown as MediaFile);

describe('service label map', () => {
  it('keys the shoot own service names by execution row id', () => {
    const labels = buildServiceLabelMap(shoot);
    expect(labels.get('101')).toBe('Exterior HDR');
    expect(labels.get('103')).toBe('Drone Photos');
    expect(labels.get('999')).toBeUndefined();
  });
});

describe('grouping media by service', () => {
  it('splits one tab into one section per booked service', () => {
    const groups = groupMediaFilesByService(
      [file('a', '101'), file('b', '102'), file('c', '101'), file('d', '103')],
      shoot,
    );

    expect(groups.map((group) => [group.label, group.files.length])).toEqual([
      ['Exterior HDR', 2],
      ['Interior HDR', 1],
      ['Drone Photos', 1],
    ]);
    expect(shouldShowServiceSections(groups)).toBe(true);
  });

  it('reads sections in the shoot own service order, not file order', () => {
    // Drone files arrive first but Drone is booked last.
    const groups = groupMediaFilesByService([file('d', '103'), file('a', '101')], shoot);
    expect(groups.map((group) => group.label)).toEqual(['Exterior HDR', 'Drone Photos']);
  });

  it('shows no sections when only one service is represented', () => {
    const groups = groupMediaFilesByService([file('a', '101'), file('b', '101')], shoot);

    expect(groups).toHaveLength(1);
    // A heading would be noise when there is nothing to distinguish.
    expect(shouldShowServiceSections(groups)).toBe(false);
  });

  it('keeps unattributed files in their own trailing section', () => {
    // Files predating per-service attribution must stay visible, not disappear.
    const groups = groupMediaFilesByService([file('a', '101'), file('legacy', null)], shoot);

    expect(groups.map((group) => group.label)).toEqual(['Exterior HDR', 'Unassigned']);
    expect(groups[1].files.map((f) => f.id)).toEqual(['legacy']);
  });

  it('separates extras into a final section rather than a service', () => {
    const groups = groupMediaFilesByService(
      [file('a', '101'), file('x', '101', true), file('b', '102')],
      shoot,
    );

    expect(groups.map((group) => group.label)).toEqual(['Exterior HDR', 'Interior HDR', 'Extras']);
    const extras = groups[groups.length - 1];
    expect(extras.isExtras).toBe(true);
    expect(extras.files.map((f) => f.id)).toEqual(['x']);
    // The extra is not double-counted inside its service section.
    expect(groups[0].files.map((f) => f.id)).toEqual(['a']);
  });

  it('labels a service the shoot does not name by its row id', () => {
    const groups = groupMediaFilesByService([file('a', '404'), file('b', '101')], shoot);
    expect(groups.map((group) => group.label)).toEqual(['Exterior HDR', 'Service #404']);
  });

  it('returns nothing for an empty tab', () => {
    expect(groupMediaFilesByService([], shoot)).toEqual([]);
    expect(shouldShowServiceSections([])).toBe(false);
  });

  it('preserves incoming order within a section so sorting still decides presentation', () => {
    const groups = groupMediaFilesByService(
      [file('c', '101'), file('a', '101'), file('b', '101')],
      shoot,
    );
    expect(groups[0].files.map((f) => f.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('every file is accounted for exactly once', () => {
  /**
   * The invariant that matters most: subgrouping is a presentation change, so it must
   * never drop a file or show one twice. A file that vanished from the gallery because
   * its service had no section would be silent data loss from the user's point of view.
   */
  const assertExhaustiveAndDisjoint = (files: MediaFile[]) => {
    const groups = groupMediaFilesByService(files, shoot);
    const grouped = groups.flatMap((group) => group.files.map((f) => f.id));

    expect(grouped).toHaveLength(files.length);
    expect(new Set(grouped).size).toBe(files.length);
    expect([...grouped].sort()).toEqual(files.map((f) => f.id).sort());
    expect(groups.reduce((sum, group) => sum + group.files.length, 0)).toBe(files.length);
  };

  it('accounts for the full verification shoot: three services in one Photos tab', () => {
    // 5 Exterior + 2 Twilight + 2 Drone = 9 files, all in the photo media kind because a
    // drone service's raw capture is stored as media_type 'raw'. The separate `drone`
    // media-kind tab only holds files explicitly tagged media_type 'drone'.
    const files = [
      file('e1', '101'), file('e2', '101'), file('e3', '101'), file('e4', '101'), file('e5', '101'),
      file('t1', '102'), file('t2', '102'),
      file('d1', '103'), file('d2', '103'),
    ];

    const groups = groupMediaFilesByService(files, shoot);

    expect(groups.map((group) => [group.label, group.files.length])).toEqual([
      ['Exterior HDR', 5],
      ['Interior HDR', 2],
      ['Drone Photos', 2],
    ]);
    assertExhaustiveAndDisjoint(files);
  });

  it('accounts for files with mixed attribution, extras and unknown services', () => {
    const files = [
      file('a', '101'),
      file('b', '102'),
      file('c', null),          // legacy, unattributed
      file('d', '404'),         // booked row the shoot payload does not name
      file('x', '101', true),   // extra inside a service
      file('y', null, true),    // extra with no service
    ];

    assertExhaustiveAndDisjoint(files);

    const groups = groupMediaFilesByService(files, shoot);
    expect(groups.map((group) => group.label)).toEqual([
      'Exterior HDR',
      'Interior HDR',
      'Service #404',
      'Unassigned',
      'Extras',
    ]);
    // Both extras land in the single Extras section, not in their services.
    expect(groups[groups.length - 1].files.map((f) => f.id).sort()).toEqual(['x', 'y']);
  });

  it('accounts for a single-service tab that renders without sections', () => {
    const files = [file('a', '101'), file('b', '101'), file('c', '101')];

    expect(shouldShowServiceSections(groupMediaFilesByService(files, shoot))).toBe(false);
    // Even in the unsectioned path the grouping must still be lossless, because the
    // caller decides between one grid and many from the same data.
    assertExhaustiveAndDisjoint(files);
  });
});
