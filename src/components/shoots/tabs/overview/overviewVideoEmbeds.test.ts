import { describe, expect, it } from 'vitest';
import {
  buildEditorTourLinksEmbedPatch,
  buildOverviewVideoEmbedsPayload,
  canAccessOverviewVideoEmbeds,
  canViewOverviewVideoEmbeds,
  canWriteOverviewVideoEmbeds,
  EDITOR_TOUR_LINK_EMBED_KEYS,
  normalizeOverviewVideoEmbeds,
} from './overviewVideoEmbeds';

describe('overviewVideoEmbeds helpers', () => {
  it('allows only video editors (assignee or video-capable assigned) — never privileged roles', () => {
    expect(canWriteOverviewVideoEmbeds('admin')).toBe(false);
    expect(canWriteOverviewVideoEmbeds('superadmin')).toBe(false);
    expect(canWriteOverviewVideoEmbeds('super_admin')).toBe(false);
    expect(canWriteOverviewVideoEmbeds('editing_manager')).toBe(false);
    expect(canWriteOverviewVideoEmbeds('salesRep')).toBe(false);
    expect(canWriteOverviewVideoEmbeds('photographer')).toBe(false);

    expect(canWriteOverviewVideoEmbeds('editor')).toBe(false);
    expect(canWriteOverviewVideoEmbeds('editor', { isAssignedEditor: true })).toBe(false);
    expect(canWriteOverviewVideoEmbeds('editor', { hasVideoCapability: true })).toBe(false);
    expect(
      canWriteOverviewVideoEmbeds('editor', {
        hasVideoCapability: true,
        isAssignedEditor: true,
      }),
    ).toBe(true);
    expect(
      canWriteOverviewVideoEmbeds('editor', { isAssignedVideoEditor: true }),
    ).toBe(true);
    expect(
      canWriteOverviewVideoEmbeds('editor', {
        isAssignedVideoEditor: true,
        hasVideoCapability: false,
        isAssignedEditor: true,
      }),
    ).toBe(true);

    // Legacy boolean isEditor alone no longer grants view.
    expect(canViewOverviewVideoEmbeds('editor', true)).toBe(false);
    expect(canViewOverviewVideoEmbeds('admin', false)).toBe(false);
    expect(canViewOverviewVideoEmbeds('client', false)).toBe(false);
    expect(
      canViewOverviewVideoEmbeds('editor', {
        isAssignedVideoEditor: true,
      }),
    ).toBe(true);
  });

  it('prefers video_link over Virtual Tours embeds for the Overview editor', () => {
    expect(
      normalizeOverviewVideoEmbeds({
        video_link: 'https://youtu.be/legacyvideo1',
        embeds: [
          { id: 'embed-a', title: 'Walkthrough', url: 'https://youtu.be/aaaaaaaaaaa' },
          { id: 'embed-b', branded: 'https://vimeo.com/123' },
        ],
      }, 377),
    ).toEqual([
      {
        id: 'embed-377-video-link',
        title: 'Video 1',
        url: 'https://youtu.be/legacyvideo1',
      },
    ]);

    expect(
      normalizeOverviewVideoEmbeds({
        embeds: [
          { id: 'embed-a', title: 'Walkthrough', url: 'https://youtu.be/aaaaaaaaaaa' },
          { id: 'embed-b', branded: 'https://vimeo.com/123' },
        ],
      }),
    ).toEqual([
      { id: 'embed-a', title: 'Walkthrough', url: 'https://youtu.be/aaaaaaaaaaa' },
    ]);
  });

  it('builds PATCH payload with video_link only (no Virtual Tours embed mirror)', () => {
    expect(
      buildOverviewVideoEmbedsPayload([
        { id: 'embed-1', title: 'Primary', url: 'https://youtu.be/primaryvideo' },
        { id: 'embed-2', title: 'Second', url: 'https://vimeo.com/222' },
      ]),
    ).toEqual({
      embeds: [],
      video_link: 'https://youtu.be/primaryvideo',
      featured_embed_id: null,
    });

    expect(buildOverviewVideoEmbedsPayload([])).toEqual({
      embeds: [],
      video_link: null,
      featured_embed_id: null,
    });
  });
});

  it('builds a slim editor tour_links patch with only BE-allowlisted keys', () => {
    const patch = buildEditorTourLinksEmbedPatch({
      embeds: [],
      video_link: 'https://vimeo.com/1231608063',
      featured_embed_id: null,
    });
    expect(Object.keys(patch).sort()).toEqual([...EDITOR_TOUR_LINK_EMBED_KEYS].filter((k) => k !== 'featured_embed').sort());
    expect(patch).toEqual({
      embeds: [],
      video_link: 'https://vimeo.com/1231608063',
      featured_embed_id: null,
    });
    expect(patch).not.toHaveProperty('property_description');
    expect(patch).not.toHaveProperty('video_branded');
    expect(patch).not.toHaveProperty('branded');
  });

