import { describe, expect, it } from 'vitest';
import { buildPublicTourEndpoint, normalizePublicTourData } from './publicTourData';

describe('public tour endpoint selection', () => {
  it.each([
    ['branded', 'branded'], ['mls', 'mls'], ['generic-mls', 'g-mls'],
  ] as const)('uses the %s public endpoint', (variant, endpoint) => {
    expect(buildPublicTourEndpoint('?shootId=123&style=homeify', variant)).toMatch(new RegExp(`/123/${endpoint}$`));
  });

  it('retains address lookup precedence, encodes values, and excludes layout parameters', () => {
    const endpoint = buildPublicTourEndpoint('?shootId=1&address=1+Oak+%26+Pine&city=New+York&state=NY&zip=10001&style=homeify', 'mls');
    expect(endpoint).toMatch(/\/mls\?address=1\+Oak\+%26\+Pine&city=New\+York&state=NY&zip=10001$/);
    expect(endpoint).not.toContain('/1/');
  });

  it('needs a complete lookup and encodes an ID as one path segment', () => {
    expect(buildPublicTourEndpoint('?address=1+Oak&city=New+York', 'branded')).toBeNull();
    expect(buildPublicTourEndpoint('?shootId=123%2Fmls', 'branded')).toMatch(/\/123%2Fmls\/branded$/);
  });
});

describe('normalizePublicTourData', () => {
  it('preserves real media order and complete floorplan preview metadata', () => {
    const floorplan = { url: 'https://media.test/floor.pdf', preview_images: ['https://media.test/floor.jpg'], label: 'First floor', floor_id: 5, units: 'imperial' };
    const result = normalizePublicTourData({
      shoot: { id: 27, address: '123 Oak Street' },
      photos: ['https://media.test/a.jpg', 'https://media.test/b.jpg', 'https://media.test/a.jpg'],
      hero_photos: ['https://media.test/b.jpg'], videos: ['https://media.test/video.mp4'], floorplans: [floorplan],
      tour_links: { tour_style: 'homeify' },
    }, 'branded');
    expect(result.heroSlides).toEqual(['https://media.test/b.jpg', 'https://media.test/a.jpg']);
    expect(result.photos).toEqual(['https://media.test/a.jpg', 'https://media.test/b.jpg']);
    expect(result.videos).toEqual(['https://media.test/video.mp4']);
    expect(result.floorplans).toEqual([floorplan]);
    expect(result.tourStyle).toBe('homeify');
    expect(result.analytics).toEqual({ shootId: 27, tourType: 'branded' });
    expect(result.empty).toBe(false);
  });

  it('derives half baths, formatted area, and garage totals without losing studio zero values', () => {
    const payload = { show_garage: true, property_details: {
      bedrooms: 0, building: [{ bedrooms: 3, fullBaths: 2, halfBaths: 1 }],
      areas: [{ type: 'Living area', areaSquareFeet: '2,500' }],
      garages: [{ carCount: 2 }, { carCount: 1 }],
      lotSize: 8000, mlsId: 'MLS123', yearBuilt: 2020,
    } };
    const result = normalizePublicTourData(payload, 'branded');
    expect(result.stats).toEqual({ beds: 0, baths: 2.5, sqft: 2500, garageCars: 3 });
    expect(result.propertyDetails).toMatchObject({ lot_size: 8000, mls_id: 'MLS123', year_built: 2020 });
    expect(normalizePublicTourData({ ...payload, show_garage: false }, 'branded').stats.garageCars).toBeNull();
    expect(normalizePublicTourData({ ...payload, show_garage: 'false' }, 'branded').showGarage).toBe(false);
  });

  it.each(['mls', 'generic-mls'] as const)('strips contact and branded fallbacks for %s even if a response includes them', (variant) => {
    const result = normalizePublicTourData({
      shoot: { id: 18, address: '123 Oak', client_name: 'Private agent', client_email: 'private@example.test' },
      branding: { logo: 'https://brand.test/logo.svg' },
      tour_links: {
        realtor_info: 'Private realtor text', video_branded: 'https://brand.test/video', video_link: 'https://brand.test/legacy-video',
        matterport: 'https://brand.test/matterport', iguide_branded: 'https://brand.test/iguide',
        embeds: [{ id: 'private', branded: 'https://brand.test/embed' }, { id: 'public', mls: 'https://public.test/embed', branded: 'https://brand.test/embed' }],
      },
    }, variant);
    expect(result.shoot).not.toHaveProperty('client_name');
    expect(result.shoot).not.toHaveProperty('client_email');
    expect(result.branding).toBeNull();
    expect(result.tourSettings.realtor_info).toBe('');
    expect(result.videoLink).toBe('');
    expect(result.matterportUrl).toBe('');
    expect(result.iguide.inlineUrl).toBe('');
    expect(result.embeds).toEqual([{ id: 'public', title: 'Tour 2', branded: '', mls: 'https://public.test/embed', value: 'https://public.test/embed' }]);
    expect(result.analytics.tourType).toBe(variant === 'mls' ? 'mls' : 'generic_mls');
  });

  it('uses canonical signed iGUIDE sources and the featured unbranded embed', () => {
    const result = normalizePublicTourData({
      iguide_viewer: { inline_url: 'https://viewer.test/inline?signature=abc', open_url: 'https://viewer.test/open?signature=xyz', source: 'published_offline_package', expires_at: '2026-09-11' },
      tour_links: { featured_embed_id: 'second', embeds: [{ id: 'first', mls: 'https://tour.test/a' }, { id: 'second', mls_embed: 'https://tour.test/b' }] },
    }, 'mls');
    expect(result.iguide.inlineUrl).toBe('https://viewer.test/inline?signature=abc');
    expect(result.iguide.openUrl).toBe('https://viewer.test/open?signature=xyz');
    expect(result.embeds.map((embed) => embed.id)).toEqual(['second', 'first']);
  });

  it.each(['branded', 'mls', 'generic-mls'] as const)('honors an explicitly unavailable canonical source for %s', (variant) => {
    for (const unavailable of [null, '', '   ', 'javascript:alert(1)']) {
      const result = normalizePublicTourData({
        video_link: unavailable, matterport_url: unavailable,
        tour_links: {
          video_branded: 'https://brand.test/video', video_mls: 'https://mls.test/video', video_generic: 'https://generic.test/video',
          matterport_branded: 'https://brand.test/tour', matterport_mls: 'https://brand.test/tour',
        },
      }, variant);
      expect(result.videoLink).toBe('');
      expect(result.matterportUrl).toBe('');
    }
  });

  it('does not restore an MLS video into an unpublished generic MLS video slot', () => {
    // Mirrors public shoot 30: MLS has a video, but the generic response has no video.
    const tour_links = { video_mls: 'https://vimeo.com/1193958606', video_generic: null };
    expect(normalizePublicTourData({ video_link: null, tour_links }, 'generic-mls').videoLink).toBe('');
    expect(normalizePublicTourData({ tour_links }, 'generic-mls').videoLink).toBe('');
    expect(normalizePublicTourData({ tour_links }, 'mls').videoLink).toBe('https://vimeo.com/1193958606');
  });

  it.each([
    ['branded', 'video_branded', 'matterport_branded'],
    ['mls', 'video_mls', 'matterport_mls'],
    ['generic-mls', 'video_generic', 'matterport_mls'],
  ] as const)('uses only audience-specific legacy sources when canonical fields are absent for %s', (variant, videoKey, tourKey) => {
    const tour_links = { [videoKey]: 'https://legacy.test/video', [tourKey]: 'https://legacy.test/tour' };
    const legacy = normalizePublicTourData({ tour_links }, variant);
    expect(legacy.videoLink).toBe('https://legacy.test/video');
    expect(legacy.matterportUrl).toBe('https://legacy.test/tour');
    const canonical = normalizePublicTourData({ video_link: 'https://canonical.test/video', matterport_url: 'https://canonical.test/tour', tour_links }, variant);
    expect(canonical.videoLink).toBe('https://canonical.test/video');
    expect(canonical.matterportUrl).toBe('https://canonical.test/tour');
  });

  it('does not infer a published variant from an unscoped legacy video link', () => {
    for (const variant of ['branded', 'mls', 'generic-mls'] as const) {
      expect(normalizePublicTourData({ tour_links: { video_link: 'https://legacy.test/unpublished-video' } }, variant).videoLink).toBe('');
    }
  });

  it('hides restricted videos and keeps locked media inaccessible', () => {
    const payload = { shoot: { id: 4 }, photos: ['https://media.test/photo.jpg'], videos: ['https://media.test/video.mp4'],
      video_link: 'https://media.test/video', matterport_url: 'https://media.test/tour', floorplans: [{ url: 'https://media.test/plan.pdf' }],
      tour_links: { embeds: [{ url: 'https://media.test/embed' }] } };
    const restricted = normalizePublicTourData({ ...payload, video_access_restricted: true }, 'branded');
    expect(restricted.videos).toEqual([]);
    expect(restricted.videoLink).toBe('');
    expect(restricted.embeds).toEqual([]);
    const locked = normalizePublicTourData({ ...payload, locked: true, message: 'Awaiting payment' }, 'branded');
    expect(locked).toMatchObject({ locked: true, lockedMessage: 'Awaiting payment', photos: [], videos: [], videoLink: '', matterportUrl: '', floorplans: [], empty: false });
  });

  it('handles missing data, unsafe URLs, and fallback floorplans', () => {
    expect(normalizePublicTourData(undefined, 'branded').empty).toBe(true);
    const result = normalizePublicTourData({ photos: [null, 123, 'javascript:alert(1)'], floorplans: [], iguide_floorplans: [{ url: 'https://media.test/floor.pdf', preview_url: 'https://media.test/floor.jpg' }] }, 'branded');
    expect(result.photos).toEqual([]);
    expect(result.floorplans).toHaveLength(1);
  });
});
