import { describe, expect, it } from 'vitest';
import type { ShootData } from '@/types/shoots';
import type { MediaFile } from '@/hooks/useShootFiles';
import { canSeeUploadSummaries, getShootMediaRequirements, uploadedAgo } from './shootMediaRequirements';
import { createUploadTransferTracker } from './uploadTransferSpeed';

const shoot = { id: '1', serviceItems: [
  { id: 11, shoot_service_id: 11, name: 'HDR Photos', photo_count: 25, upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5 },
  { id: 12, shoot_service_id: 12, name: 'Drone', photo_count: 10, upload_intake_type: 'photo', uses_hdr_brackets: false },
  { id: 13, shoot_service_id: 13, name: 'Video', upload_intake_type: 'video' },
] } as unknown as ShootData;
const file = (id: number, serviceId: number, extra = false) => ({ id: String(id), filename: `${id}.CR3`, shoot_service_id: serviceId, isExtra: extra } as MediaFile);

describe('staff media requirements and completion time', () => {
  it.each(['admin', 'superadmin', 'editing_manager', 'photographer', 'salesRep', 'rep', 'representative'])('allows %s and never a client view', role => {
    expect(canSeeUploadSummaries(role)).toBe(true);
    expect(canSeeUploadSummaries(role, true)).toBe(false);
  });
  it.each(['client', 'editor', '', 'unknown'])('hides staff summaries for %s', role => expect(canSeeUploadSummaries(role)).toBe(false));
  it('uses per-service brackets, ignores videos/extras, and does not let oversupply hide a missing service', () => {
    const files = Array.from({ length: 135 }, (_, i) => file(i, 11));
    files.push(file(200, 12, true), { id: '201', filename: 'video.mp4', fileType: 'video/mp4', shoot_service_id: 13 } as MediaFile);
    const r = getShootMediaRequirements(shoot, files);
    expect(r).toMatchObject({ expected: 135, finalCount: 35, saved: 135, missing: 10, exact: true });
    expect(r.services).toMatchObject([
      { id: '11', required: 125, saved: 135, missing: 0, finalCount: 25, rawPerFinal: 5 },
      { id: '12', required: 10, saved: 0, missing: 10, finalCount: 10, rawPerFinal: 1 },
    ]);
    expect(r.videoServices).toEqual([{ id: '13', label: 'Video' }]);
  });
  it('does not invent a count for an unconfigured photo service', () => {
    const r = getShootMediaRequirements({ id: '1', serviceItems: [{ id: 11, shoot_service_id: 11, upload_intake_type: 'photo', quantity: 1 }] } as unknown as ShootData, []);
    expect(r).toMatchObject({ expected: 0, exact: false, finalExact: false });
    expect(r.services[0]).toMatchObject({ required: null, finalCount: null, rawPerFinal: null, missing: null });
  });
  it('uses the same package source as the service rows when an alias is empty', () => {
    const bundle = { id: '91', shoot_service_id: '11', name: 'HDR Photos, Video & iGuide',
      photo_count: 45, upload_intake_type: 'photo_video', uses_hdr_brackets: true, effective_bracket_mode: 3 };
    const r = getShootMediaRequirements({ id: '1', serviceItems: [], service_items: [], serviceObjects: [bundle] } as unknown as ShootData, []);
    expect(r).toMatchObject({ finalCount: 45, expected: 135, exact: true, finalExact: true });
    expect(r.services).toMatchObject([{ id: '11', required: 135, finalCount: 45 }]);
    expect(r.videoServices).toEqual([{ id: '11', label: bundle.name }]);
  });
  it('counts legacy sources without service attribution', () => {
    const r = getShootMediaRequirements(shoot, Array.from({ length: 8 }, (_, i) => file(i, 0)));
    expect(r).toMatchObject({ saved: 8, missing: 127 });
    expect(r.unassigned).toBe(8);
  });
  it('scopes photographer requirements to the same assigned services as the gallery', () => {
    const assigned = { ...shoot, serviceItems: shoot.serviceItems?.map((service, index) => ({ ...service, photographer_id: index === 0 ? '7' : '8' })) } as ShootData;
    const r = getShootMediaRequirements(assigned, [file(1, 11)], { id: 7, role: 'photographer' });
    expect(r).toMatchObject({ expected: 125, finalCount: 25, saved: 1, missing: 124 });
    expect(r.services.map(service => service.id)).toEqual(['11']);
    expect(r.videoServices).toEqual([]);
  });
  it.each([[450, '450 ms'], [3000, '3 seconds'], [120000, '2 minutes'], [7200000, '2 hours'], [172800000, '2 days'], [1209600000, '2 weeks'], [63072000000, '2 years']] as const)('formats uploaded time at %s ms', (elapsed, text) => {
    expect(uploadedAgo(new Date(0).toISOString(), elapsed)).toBe(`Uploaded ${text} ago`);
  });
});

describe('combined transfer speed', () => {
  it('adds concurrent byte deltas but does not count server processing or double-count repeated events', () => {
    const tracker = createUploadTransferTracker([1000, 1000], 0);
    tracker.update(0, 500, 1000, 'transferring', 500);
    const second = tracker.update(1, 500, 1000, 'transferring', 1000);
    expect(second.bytesPerSecond).toBe(1000);
    const processing = tracker.update(0, 1000, 1000, 'processing', 1000);
    expect(processing).toMatchObject({ bytesPerSecond: 1000, phase: 'transferring' });
    expect(tracker.update(1, 500, 1000, 'transferring', 1000).bytesPerSecond).toBe(1000);
    expect(tracker.update(1, 1000, 1000, 'processing', 1000).phase).toBe('processing');
  });
  it('counts actual retransmitted bytes when a retry restarts at zero', () => {
    const tracker = createUploadTransferTracker([1000], 0);
    tracker.update(0, 500, 1000, 'transferring', 500);
    tracker.update(0, 0, 1000, 'transferring', 500);
    expect(tracker.update(0, 500, 1000, 'transferring', 1000).bytesPerSecond).toBe(1000);
  });
});
