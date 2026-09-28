import { describe, expect, it } from 'vitest';
import type { ShootData, ShootFileData, ShootServiceObject } from '@/types/shoots';
import { projectUnitTour } from '@/features/shoot-units/unitTourData';
import { buildShootDownloadCenterModel, type ShootDownloadCenterOptions } from './shootDownloadCenterModel';

const options: ShootDownloadCenterOptions = {
  isClient: true, canDownloadWholeShoot: true, canAccessTours: true, baseUrl: 'https://dashboard.test',
};
const line = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, shoot_service_id: id, service_id: `catalog-${id}`, name, quantity: 1, price: 100,
  is_deliverable: true, is_unlocked_for_delivery: true, delivery_status: 'ready', workflow_status: 'delivered', ...extra,
}) as ShootServiceObject;
const file = (id: string, filename: string, extra: Record<string, unknown> = {}) => ({
  id, filename, workflow_stage: 'verified', ...extra,
}) as ShootFileData;
const shoot = (extra: Record<string, unknown> = {}) => ({ id: '42', files: [], services: [], ...extra }) as unknown as ShootData;
const build = (data: ShootData, overrides: Partial<ShootDownloadCenterOptions> = {}) => buildShootDownloadCenterModel(data, { ...options, ...overrides });

describe('client download checklist model', () => {
  it('separates photos, edited video files, PDF originals and each guarded JPG page', () => {
    const result = build(shoot({ serviceItems: [line('1', 'Photos & Floor Plans')], files: [
      file('photo', 'front.jpg', { shoot_service_id: '1', media_type: 'photo' }),
      file('legacy', 'rear.jpg', { shoot_service_id: '1' }),
      file('plan', 'plan.jpg', { shoot_service_id: '1', media_type: 'floorplan' }),
      file('pdf', 'plan.pdf', { shoot_service_id: '1', preview_images: ['page-one.jpg', 'page-two.jpg'] }),
      file('video', 'edited.mp4', { shoot_service_id: '1', media_type: 'video' }),
      file('raw', 'raw.jpg', { shoot_service_id: '1', workflow_stage: 'todo' }),
      file('raw-verified', 'raw-verified.tiff', { shoot_service_id: '1', file_type: 'raw' }),
      file('extra', 'extra.jpg', { shoot_service_id: '1', is_extra: true }),
      file('infected', 'bad.jpg', { shoot_service_id: '1', scan_status: 'infected' }),
      file('pending', 'scan.jpg', { shoot_service_id: '1', scan_status: 'pending' }),
      file('hidden', 'hide.jpg', { shoot_service_id: '1', is_hidden: true }),
    ] }));
    expect(result.wholeShootPhotoCount).toBe(2);
    expect(result.services).toEqual([{ id: '1', shootServiceId: '1', name: 'Photos & Floor Plans', photoCount: 2 }]);
    expect(result.editedVideos.map(item => item.fileId)).toEqual(['video']);
    expect(result.floorplanPdfs.map(item => item.fileId)).toEqual(['pdf']);
    expect(result.floorplanJpgs.map(item => [item.fileId, item.format, item.page])).toEqual([
      ['plan', undefined, undefined], ['pdf', 'jpg', 1], ['pdf', 'jpg', 2],
    ]);
  });

  it('classifies untyped floorplan-only service JPGs without consuming mixed-package photos', () => {
    const result = build(shoot({ serviceItems: [line('fp', 'Premium iGuide'), line('mixed', 'Photos & Floor Plans')], files: [
      file('fp', 'first.jpg', { shoot_service_id: 'fp' }),
      file('photo', 'second.jpg', { shoot_service_id: 'mixed' }),
      file('provider', 'third.jpg', { shoot_service_id: 'mixed', provider_asset_key: 'jpg_metric_floor_1' }),
      file('report', 'report.pdf', { shoot_service_id: 'fp', provider_asset_key: 'pdf_home_report_1' }),
    ] }));
    expect(result.wholeShootPhotoCount).toBe(1);
    expect(result.floorplanJpgs.map(item => item.fileId)).toEqual(['fp', 'provider']);
    expect(result.floorplanPdfs).toEqual([]);
  });

  it('honors the server asset classification used by ZIPs and keeps legacy fallback', () => {
    const result = build(shoot({ serviceItems: [line('i', 'iGuide')], files: [
      file('photo', 'gallery.jpg', { shoot_service_id: 'i', download_asset_type: 'photos' }),
      file('floor', 'other.jpg', { shoot_service_id: 'i', download_asset_type: 'floorplans' }),
      file('report', 'report.pdf', { shoot_service_id: 'i', download_asset_type: 'other' }),
      file('video', 'movie.bin', { shoot_service_id: 'i', download_asset_type: 'videos' }),
      file('legacy', 'old.jpg'),
    ] }));
    expect(result.wholeShootPhotoCount).toBe(2);
    expect(result.floorplanJpgs.map(item => item.fileId)).toEqual(['floor']);
    expect(result.floorplanPdfs).toEqual([]);
    expect(result.editedVideos.map(item => item.fileId)).toEqual(['video']);
  });

  it('uses exact hosted video variants and keeps external video URLs out of file downloads', () => {
    const result = build(shoot({ serviceItems: [line('v', 'Property Video')], tour_links: {
      video_link: 'https://youtube.com/watch?v=raw', video_branded: 'https://vimeo.com/111', video_generic: 'https://vimeo.com/222',
    } }));
    expect(result.editedVideos).toEqual([]);
    expect(result.videoLinks.map(item => item.href)).toEqual([
      'https://dashboard.test/tour/video/branded?shootId=42', 'https://dashboard.test/tour/video/generic?shootId=42',
    ]);
    expect(result.videoLinks.every(item => item.action === 'link')).toBe(true);
    expect(build(shoot({ serviceItems: [line('v', 'Video')], tourLinks: { video_link: 'https://youtube.com/watch?v=raw' } })).videoLinks).toEqual([]);
  });

  it('shows only ordered available 3D providers and suppresses false unbranded duplicates', () => {
    const result = build(shoot({ serviceItems: [line('m', 'Matterport 3D'), line('z', 'Zillow 3D')], tourLinks: {
      matterport: 'https://my.matterport.com/show/?m=123', matterport_mls: 'https://my.matterport.com/show/?m=123',
      iguide_branded: 'https://tour.iguide.com/unordered', zillow_3d: 'https://zillow.com/view-3d-home/123',
    } }));
    expect(result.threeDLinks.map(item => item.id)).toEqual(['tour-matterport_branded', 'tour-zillow_3d']);
    expect(result.threeDLinks.every(item => item.href?.includes('/tour/3d/'))).toBe(true);
    const generic = build(shoot({ serviceItems: [line('g', '3D Tour')], tourLinks: { zillow_3d: 'https://zillow.com/3d' } }));
    expect(generic.threeDLinks.map(item => item.id)).toEqual(['tour-zillow_3d']);
  });

  it('offers offline-only iGUIDE wrappers solely for server-approved published audiences', () => {
    const data = shoot({ serviceItems: [line('i', 'iGUIDE 3D')], iguide_data: {
      manual_offline_package: { status: 'ready', view_only: true, published_audiences: ['branded', 'mls'] },
    } });
    expect(build(data).threeDLinks.map(item => item.href)).toEqual([
      'https://dashboard.test/tour/3d/branded?shootId=42&provider=iguide',
      'https://dashboard.test/tour/3d/mls?shootId=42&provider=iguide',
    ]);
    expect(build({ ...data, iguideManualOfflinePackage: { status: 'ready' } }).threeDLinks).toEqual([]);
    expect(build({ ...data, iguideManualOfflinePackage: { status: 'ready', published_audiences: ['branded'] } }).threeDLinks.map(item => item.id)).toEqual(['tour-iguide_branded']);
    expect(build({ ...data, iguideManualOfflinePackage: { status: 'scanning', published_audiences: ['branded'] } }).threeDLinks).toEqual([]);
    expect(build({ ...data, serviceItems: [line('i', 'iGUIDE 3D', { delivery_status: 'pending' })] }).threeDLinks).toEqual([]);
    const unit = { id: 5, label: 'A', kind: 'unit', provider_data: { iguide_data: data.iguide_data } };
    const multi = shoot({ units: [unit], service_lines: [line('i', 'iGUIDE 3D', { shoot_unit_id: 5 })] });
    expect(build(projectUnitTour(multi, multi.units![0]), { unitId: 5 }).threeDLinks.every(item => item.href?.includes('unitId=5'))).toBe(true);
  });

  it('does not let a ready photo line unlock video, 3D or files from locked/cancelled service lines', () => {
    const result = build(shoot({ serviceItems: [
      line('p', 'Photos'), line('v', 'Video', { is_unlocked_for_delivery: false }),
      line('m', 'Matterport 3D', { delivery_status: 'pending' }),
      line('c', 'iGuide', { workflow_status: 'cancelled' }),
    ], files: [file('p', 'photo.jpg', { shoot_service_id: 'p' }), file('v', 'movie.mp4', { shoot_service_id: 'v' }),
      file('m', 'plan.pdf', { shoot_service_id: 'm' }), file('none', 'unassigned.jpg')],
    tourLinks: { video_branded: 'https://vimeo.com/123', matterport_branded: 'https://matterport.com/123', iguide_branded: 'https://iguide.com/123' },
    }), { canDownloadWholeShoot: false });
    expect(result.wholeShootPhotoCount).toBe(0);
    expect(result.services.map(service => service.id)).toEqual(['p']);
    expect(result.editedVideos).toEqual([]);
    expect(result.videoLinks).toEqual([]);
    expect(result.threeDLinks).toEqual([]);
    expect(result.floorplanPdfs).toEqual([]);
  });

  it('withholds explicitly unfinished hosted deliveries even after the whole shoot is paid', () => {
    const data = shoot({ payment_status: 'paid', serviceItems: [line('p', 'Photos'),
      line('v', 'Video', { delivery_status: 'pending' }), line('m', 'Matterport', { delivery_status: 'processing' })],
    tourLinks: { video_branded: 'https://vimeo.com/123', matterport_branded: 'https://matterport.com/123' } });
    const result = build(data);
    expect(result.videoLinks).toEqual([]);
    expect(result.threeDLinks).toEqual([]);
    expect(build(shoot({ serviceItems: [line('v', 'Video', { delivery_status: null })], tourLinks: data.tourLinks })).videoLinks).toHaveLength(1);
  });

  it('keeps every wrapper and asset scoped to the projected selected unit', () => {
    const unitA = { id: 1, label: 'A', kind: 'unit', tour_links: { video_branded: 'https://vimeo.com/a' },
      provider_data: { lines: { a: { iguide_floorplans: [{ url: 'https://assets.test/a.pdf', type: 'pdf' }] }, b: { iguide_floorplans: [{ url: 'https://assets.test/b.pdf' }] } } } };
    const data = shoot({ units: [unitA, { id: 2, label: 'B' }], service_lines: [
      line('a', 'iGuide & Video', { shoot_unit_id: 1 }), line('b', 'iGuide & Video', { shoot_unit_id: 2 }),
    ], tourLinks: { video_branded: 'https://vimeo.com/building' }, files: [file('a', 'a.jpg', { shoot_service_id: 'a' }), file('b', 'b.jpg', { shoot_service_id: 'b' })] });
    const result = build(projectUnitTour(data, data.units![0]), { unitId: 1, isClient: false });
    expect(result.wholeShootPhotoCount).toBe(1);
    expect(result.floorplanPdfs.map(item => item.href)).toEqual(['https://assets.test/a.pdf']);
    expect(result.videoLinks[0].href).toContain('unitId=1');
    expect(result.tourLinks.every(item => item.href?.includes('unitId=1'))).toBe(true);
  });

  it('supports snake/camel provider PDF/JPG lists for staff while preferring ingested guarded copies', () => {
    const data = shoot({ serviceItems: [line('i', 'iGuide'), line('c', 'CubiCasa')], files: [
      file('copy', 'ingested.pdf', { shoot_service_id: 'i', provider_source_url: 'https://assets.test/local.pdf' }),
    ], iguide_floorplans: [{ url: 'https://assets.test/local.pdf' }, { url: 'https://assets.test/i.jpg', type: 'jpg' }],
    cubicasaFloorplans: [{ url: 'https://assets.test/c.pdf', type: 'pdf' }, { url: 'https://assets.test/report.pdf', asset_key: 'pdf_home_report_0' }],
    iguide_data: { pdf_metric_url: 'https://assets.test/metric.pdf', jpg_imperial: [{ url: 'https://assets.test/imperial.jpg' }] },
    });
    const result = build(data, { isClient: false });
    expect(result.floorplanPdfs.map(item => item.fileId ?? item.href)).toEqual(['copy', 'https://assets.test/metric.pdf', 'https://assets.test/c.pdf']);
    expect(result.floorplanJpgs.map(item => item.href)).toEqual(['https://assets.test/i.jpg', 'https://assets.test/imperial.jpg']);
    expect(build(data).floorplanPdfs.map(item => item.fileId)).toEqual(['copy']);
    expect(build(data).floorplanJpgs).toEqual([]);
  });

  it('rejects unsafe or credential-bearing URLs and respects the tour access gate', () => {
    const data = shoot({ serviceItems: [line('v', 'Video'), line('m', 'Matterport')], tourLinks: {
      video_branded: 'javascript:alert(1)', video_mls: 'https://user:password@example.com/movie', matterport_branded: 'data:text/html,hi',
    } });
    const result = build(data);
    expect(result.videoLinks).toEqual([]);
    expect(result.threeDLinks).toEqual([]);
    expect(result.tourLinks).toEqual([]);
    expect(build(shoot({ files: [file('p', 'photo.jpg')], tourLinks: { video_branded: 'https://vimeo.com/1' } }), { canAccessTours: false }).tourLinks).toEqual([]);
    expect(build(shoot({ tourLinks: { video_branded: 'http://insecure.test/video' } })).videoLinks).toEqual([]);
    expect(build(shoot({ tourLinks: { video_branded: 'http://localhost:5192/movie' } }), { baseUrl: 'http://localhost:5192' }).videoLinks[0].href)
      .toBe('http://localhost:5192/tour/video/branded?shootId=42');
  });

  it('keeps empty shoots empty and returns property tours after available deliverables', () => {
    expect(buildShootDownloadCenterModel(null, options).totalItems).toBe(0);
    expect(build(shoot()).totalItems).toBe(0);
    const result = build(shoot({ files: [file('p', 'photo.jpg')] }));
    expect(result.tourLinks.map(item => item.href)).toEqual([
      'https://dashboard.test/tour/branded?shootId=42', 'https://dashboard.test/tour/mls?shootId=42', 'https://dashboard.test/tour/g-mls?shootId=42',
    ]);
  });

  it('retains legacy snake-case generic tour links when no local file is attached', () => {
    const result = build(shoot({ tour_links: { generic_mls: 'https://dashboard.test/tour/g-mls?shootId=42' } }));
    expect(result.tourLinks.map(item => item.id)).toEqual(['tour-branded', 'tour-mls', 'tour-genericMls']);
    expect(result.tourLinks[2].href).toBe('https://dashboard.test/tour/g-mls?shootId=42');
  });
});
