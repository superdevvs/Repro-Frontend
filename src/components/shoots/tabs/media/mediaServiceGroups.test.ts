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

describe('naming is independent of editing eligibility', () => {
  /**
   * `serviceItems` is the operational payload and is narrowed by workflow
   * eligibility: an editor does not receive rows for services they may not edit
   * (anything with requires_editing = false, such as a drone package). Files for
   * those services still reach them, so the gallery had a file whose service it
   * could not name and rendered the raw row id instead.
   *
   * `servicePresentation` is display-only and never narrowed, which is what makes
   * a real name available without granting the editor anything new.
   */
  const editorShoot = {
    id: '1',
    // What an editor actually receives: the drone row (117) is filtered out.
    serviceItems: [{ shoot_service_id: '116', name: '10 Exterior HDR Photos' }],
    servicePresentation: [
      { shoot_service_id: '116', service_id: '6', name: '10 Exterior HDR Photos' },
      { shoot_service_id: '117', service_id: '15', name: '10-12 Drone Photos Package' },
      { shoot_service_id: '118', service_id: '18', name: 'Virtual Staging (per image)' },
    ],
  } as unknown as ShootData;

  it('names a service the viewer may see but may not edit', () => {
    const labels = buildServiceLabelMap(editorShoot);
    expect(labels.get('117')).toBe('10-12 Drone Photos Package');
  });

  it('renders the real service name instead of Service #<id> for that subgroup', () => {
    const groups = groupMediaFilesByService([file('a', '116'), file('b', '117')], editorShoot);

    expect(groups.map((group) => group.label)).toEqual([
      '10 Exterior HDR Photos',
      '10-12 Drone Photos Package',
    ]);
    // The regression this replaces.
    expect(groups.map((group) => group.label)).not.toContain('Service #117');
  });

  it('reads the snake_case payload alias too', () => {
    const snake = {
      id: '1',
      service_presentation: [{ shoot_service_id: '117', name: '10-12 Drone Photos Package' }],
    } as unknown as ShootData;

    expect(buildServiceLabelMap(snake).get('117')).toBe('10-12 Drone Photos Package');
  });

  it('still works from serviceItems alone, so an older payload is unaffected', () => {
    const labels = buildServiceLabelMap(shoot);
    expect(labels.get('101')).toBe('Exterior HDR');
    expect(labels.get('103')).toBe('Drone Photos');
  });

  it('keeps the row-id fallback for a service no payload names', () => {
    // Presentation resolves what it knows; a genuinely unknown row must still be
    // visible rather than silently dropped.
    const groups = groupMediaFilesByService([file('a', '116'), file('z', '999')], editorShoot);
    expect(groups.map((group) => group.label)).toEqual(['10 Exterior HDR Photos', 'Service #999']);
  });

  it('does not invent sections for services with no files', () => {
    // Presentation lists every booked service, but only services that actually
    // delivered media may appear as a section.
    const groups = groupMediaFilesByService([file('a', '116')], editorShoot);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('10 Exterior HDR Photos');
  });
});

describe('provider-delivered floorplans keep their own section', () => {
  const floorplan = (id: string, source: string | null, serviceId: string | null = null): MediaFile => ({
    id,
    shoot_service_id: serviceId,
    media_type: 'floorplan',
    media_source: source,
  } as unknown as MediaFile);

  const fpShoot = {
    id: '1',
    servicePresentation: [{ shoot_service_id: '201', name: '2D Floor plans' }],
  } as unknown as ShootData;

  it('groups an iGuide floorplan under iGuide rather than Unassigned', () => {
    const groups = groupMediaFilesByService(
      [floorplan('booked', null, '201'), floorplan('ig', 'iguide')],
      fpShoot,
    );

    expect(groups.map((group) => group.label)).toEqual(['2D Floor plans', 'iGuide Floor Plans']);
    expect(groups.map((group) => group.label)).not.toContain('Unassigned');
  });

  it('groups a CubiCasa floorplan under CubiCasa', () => {
    const groups = groupMediaFilesByService(
      [floorplan('booked', null, '201'), floorplan('cc', 'cubicasa')],
      fpShoot,
    );
    expect(groups.map((group) => group.label)).toEqual(['2D Floor plans', 'CubiCasa Floor Plans']);
  });

  it('separates two providers on the same shoot', () => {
    const groups = groupMediaFilesByService(
      [floorplan('ig', 'iguide'), floorplan('cc', 'cubicasa'), floorplan('ig2', 'iguide')],
      fpShoot,
    );

    expect(groups.map((group) => [group.label, group.files.length])).toEqual([
      ['CubiCasa Floor Plans', 1],
      ['iGuide Floor Plans', 2],
    ]);
  });

  it('leaves a provider floorplan that does have a booked service on that service', () => {
    // Provider attribution is only a fallback for the missing pivot; it must not
    // pull a file out of the service that actually paid for it.
    const groups = groupMediaFilesByService([floorplan('ig', 'iguide', '201')], fpShoot);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('2D Floor plans');
  });

  it('ignores an unrecognised provider and falls back to Unassigned', () => {
    const groups = groupMediaFilesByService(
      [floorplan('booked', null, '201'), floorplan('mystery', 'some-new-provider')],
      fpShoot,
    );
    expect(groups.map((group) => group.label)).toEqual(['2D Floor plans', 'Unassigned']);
  });

  it('never applies a floorplan provider label to non-floorplan media', () => {
    // media_source is only written by the floorplan ingestion jobs today; scoping
    // the label to floorplan media keeps it from misdescribing anything else.
    const photo = {
      id: 'p',
      shoot_service_id: null,
      media_type: 'raw',
      media_source: 'iguide',
    } as unknown as MediaFile;

    const groups = groupMediaFilesByService([floorplan('booked', null, '201'), photo], fpShoot);
    expect(groups.map((group) => group.label)).toEqual(['2D Floor plans', 'Unassigned']);
  });

  it('does not lose or duplicate provider files', () => {
    const files = [
      floorplan('booked', null, '201'),
      floorplan('ig', 'iguide'),
      floorplan('cc', 'cubicasa'),
      floorplan('legacy', null),
    ];

    const groups = groupMediaFilesByService(files, fpShoot);
    const grouped = groups.flatMap((group) => group.files.map((f) => f.id));

    expect([...grouped].sort()).toEqual(['booked', 'cc', 'ig', 'legacy']);
    expect(new Set(grouped).size).toBe(files.length);
  });
});
