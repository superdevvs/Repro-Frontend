import { describe, expect, it } from 'vitest';
import { setQueueClassification } from './mediaUploadUtils';
import {
  addFilesToStagedGroup,
  buildUploadGroupPlans,
  countStagedFiles,
  createStagedUploadGroup,
  findStagedGroupForFile,
  getStagedMediaTypeCounts,
  getUploadFileContext,
  rememberUploadFileContext,
  removeFileFromStagedGroup,
  removeFilesFromStagedGroups,
  restageFailedUploadGroups,
  validateStagedUploadGroups,
  type StagedUploadGroup,
} from './uploadGroups';

const makeFile = (name: string) => new File(['pixels'], name, { type: 'image/jpeg' });

const groupWith = (id: string, serviceId: string, names: string[]): StagedUploadGroup =>
  addFilesToStagedGroup(createStagedUploadGroup(serviceId, id), names.map(makeFile));

describe('staged upload groups', () => {
  it('keeps each group independent so the same filename in two services does not collide', () => {
    // getQueueFileKey ignores its index argument and keys on name/size/lastModified,
    // so a single shared classification map would let one group overwrite the other.
    const hdr = groupWith('g1', '10', ['front.jpg']);
    const drone = groupWith('g2', '20', ['front.jpg']);

    const taggedDrone: StagedUploadGroup = {
      ...drone,
      classifications: setQueueClassification(drone.files[0], 0, 'drone', drone.classifications),
    };

    expect(Object.values(taggedDrone.classifications)).toEqual(['drone']);
    expect(hdr.classifications).toEqual({});
  });

  it('adds, counts and removes files without disturbing sibling groups', () => {
    let groups = [groupWith('g1', '10', ['a.jpg', 'b.jpg']), groupWith('g2', '20', ['c.jpg'])];
    expect(countStagedFiles(groups)).toBe(3);

    groups = [removeFileFromStagedGroup(groups[0], 0), groups[1]];
    expect(groups[0].files.map((f) => f.name)).toEqual(['b.jpg']);
    expect(groups[1].files.map((f) => f.name)).toEqual(['c.jpg']);
    expect(countStagedFiles(groups)).toBe(2);
  });

  it('aggregates media-type counts across groups for the shoot-wide strip', () => {
    const hdr = groupWith('g1', '10', ['a.jpg', 'b.jpg']);
    const drone = groupWith('g2', '20', ['c.jpg']);
    const taggedHdr: StagedUploadGroup = {
      ...hdr,
      classifications: setQueueClassification(hdr.files[0], 0, 'twilight', hdr.classifications),
    };
    const taggedDrone: StagedUploadGroup = {
      ...drone,
      classifications: setQueueClassification(drone.files[0], 0, 'drone', drone.classifications),
    };

    const counts = getStagedMediaTypeCounts([taggedHdr, taggedDrone]);
    expect(counts.twilight).toBe(1);
    expect(counts.drone).toBe(1);
    expect(counts.extra).toBe(0);
  });
});

describe('upload group plans', () => {
  it('gives every group its own batch id and omits the bracket for non-bracket services', () => {
    const groups = [
      groupWith('g1', '10', ['hdr-1.jpg', 'hdr-2.jpg']),
      groupWith('g2', '20', ['drone-1.jpg']),
      groupWith('g3', '', ['loose.jpg']),
    ];
    let counter = 0;

    const plans = buildUploadGroupPlans(groups, {
      createBatchId: () => `batch-${(counter += 1)}`,
      // Only the HDR service brackets.
      resolveBracketMode: (serviceId) => (serviceId === '10' ? 5 : null),
    });

    expect(plans.map((plan) => plan.uploadBatchId)).toEqual(['batch-1', 'batch-2', 'batch-3']);
    expect(new Set(plans.map((plan) => plan.uploadBatchId)).size).toBe(3);
    expect(plans.map((plan) => plan.bracketMode)).toEqual([5, null, null]);
    expect(plans.map((plan) => plan.serviceId)).toEqual(['10', '20', '']);
    expect(plans.map((plan) => plan.groupId)).toEqual(['g1', 'g2', 'g3']);
  });

  it('drops empty groups and preserves staging order', () => {
    const groups = [
      createStagedUploadGroup('10', 'g1'),
      groupWith('g2', '20', ['a.jpg']),
      groupWith('g3', '30', ['b.jpg']),
    ];

    const plans = buildUploadGroupPlans(groups, { resolveBracketMode: () => null });
    expect(plans.map((plan) => plan.groupId)).toEqual(['g2', 'g3']);
  });

  it('snapshots the plan onto each file so a retry cannot read the current picker', () => {
    const group = groupWith('g1', '10', ['front.jpg']);
    const [file] = group.files;

    rememberUploadFileContext(file, { serviceId: '10', bracketMode: 5 });
    // The picker auto-advances to the next service once files land; the file must
    // still report the service it was actually uploaded under.
    rememberUploadFileContext(group.files[0], { serviceId: '10', bracketMode: 5 });

    expect(getUploadFileContext(file)).toEqual({ serviceId: '10', bracketMode: 5 });
    expect(getUploadFileContext(makeFile('other.jpg'))).toBeUndefined();
  });
});

describe('validation', () => {
  it('refuses an empty queue', () => {
    expect(validateStagedUploadGroups([], { requireService: true }).ok).toBe(false);
    expect(validateStagedUploadGroups([createStagedUploadGroup('10')], { requireService: true }).ok).toBe(false);
  });

  it('requires a service per group only when the actor needs one', () => {
    const groups = [groupWith('g1', '10', ['a.jpg']), groupWith('g2', '', ['b.jpg'])];

    const enforced = validateStagedUploadGroups(groups, { requireService: true });
    expect(enforced.ok).toBe(false);
    expect(enforced.message).toMatch(/no service selected/i);

    expect(validateStagedUploadGroups(groups, { requireService: false }).ok).toBe(true);
  });

  it('passes when every staged group names a service', () => {
    const groups = [groupWith('g1', '10', ['a.jpg']), groupWith('g2', '20', ['b.jpg'])];
    expect(validateStagedUploadGroups(groups, { requireService: true })).toEqual({ ok: true });
  });
});

describe('failure handling', () => {
  it('re-stages failed files under their original service, dropping groups that fully succeeded', () => {
    const groups = [
      groupWith('g1', '10', ['hdr-1.jpg', 'hdr-2.jpg']),
      groupWith('g2', '20', ['drone-1.jpg']),
    ];
    const plans = buildUploadGroupPlans(groups, {
      createBatchId: () => 'batch',
      resolveBracketMode: (serviceId) => (serviceId === '10' ? 5 : null),
    });

    // hdr-2 failed, everything else landed.
    const failed = new Set<File>([plans[0].files[1]]);
    const restaged = restageFailedUploadGroups(plans, failed);

    expect(restaged).toHaveLength(1);
    expect(restaged[0].serviceId).toBe('10');
    expect(restaged[0].id).toBe('g1');
    expect(restaged[0].files.map((f) => f.name)).toEqual(['hdr-2.jpg']);
  });

  it('carries a failed file classification through the re-stage', () => {
    const group = groupWith('g1', '10', ['a.jpg']);
    const staged: StagedUploadGroup = {
      ...group,
      classifications: setQueueClassification(group.files[0], 0, 'extra', group.classifications),
    };
    const plans = buildUploadGroupPlans([staged], { resolveBracketMode: () => null });

    const restaged = restageFailedUploadGroups(plans, new Set(plans[0].files));
    expect(Object.values(restaged[0].classifications)).toEqual(['extra']);
  });

  it('removes retried files and prunes groups left empty', () => {
    const groups = [groupWith('g1', '10', ['a.jpg', 'b.jpg']), groupWith('g2', '20', ['c.jpg'])];
    const done = new Set<File>([groups[0].files[0], groups[1].files[0]]);

    const remaining = removeFilesFromStagedGroups(groups, done);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('g1');
    expect(remaining[0].files.map((f) => f.name)).toEqual(['b.jpg']);
  });

  it('finds the group holding a file so its service can be recovered', () => {
    const groups = [groupWith('g1', '10', ['a.jpg']), groupWith('g2', '20', ['b.jpg'])];
    expect(findStagedGroupForFile(groups, groups[1].files[0])?.serviceId).toBe('20');
    expect(findStagedGroupForFile(groups, makeFile('nope.jpg'))).toBeUndefined();
  });
});
