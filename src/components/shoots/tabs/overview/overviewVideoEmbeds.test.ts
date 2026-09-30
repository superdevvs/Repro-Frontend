import { describe, expect, it } from 'vitest';
import {
  buildOverviewVideoEmbedsPayload,
  canAccessOverviewVideoEmbeds,
  canViewOverviewVideoEmbeds,
  canWriteOverviewVideoEmbeds,
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

  it('normalizes embeds from url-first shape and seeds from video_link', () => {
    expect(
      normalizeOverviewVideoEmbeds({
        embeds: [
          { id: 'embed-a', title: 'Walkthrough', url: 'https://youtu.be/aaaaaaaaaaa' },
          { id: 'embed-b', branded: 'https://vimeo.com/123' },
        ],
      }),
    ).toEqual([
      { id: 'embed-a', title: 'Walkthrough', url: 'https://youtu.be/aaaaaaaaaaa' },
      { id: 'embed-b', title: 'Video 2', url: 'https://vimeo.com/123' },
    ]);

    expect(
      normalizeOverviewVideoEmbeds({ video_link: 'https://youtu.be/legacyvideo1' }, 377),
    ).toEqual([
      {
        id: 'embed-377-video-link',
        title: 'Video 1',
        url: 'https://youtu.be/legacyvideo1',
      },
    ]);
  });

  it('builds PATCH payload with video_link synced to the first embed', () => {
    expect(
      buildOverviewVideoEmbedsPayload([
        { id: 'embed-1', title: 'Primary', url: 'https://youtu.be/primaryvideo' },
        { id: 'embed-2', title: 'Second', url: 'https://vimeo.com/222' },
      ]),
    ).toEqual({
      embeds: [
        {
          id: 'embed-1',
          title: 'Primary',
          url: 'https://youtu.be/primaryvideo',
          branded: 'https://youtu.be/primaryvideo',
          branded_embed: 'https://youtu.be/primaryvideo',
          mls: 'https://youtu.be/primaryvideo',
          mls_embed: 'https://youtu.be/primaryvideo',
        },
        {
          id: 'embed-2',
          title: 'Second',
          url: 'https://vimeo.com/222',
          branded: 'https://vimeo.com/222',
          branded_embed: 'https://vimeo.com/222',
          mls: 'https://vimeo.com/222',
          mls_embed: 'https://vimeo.com/222',
        },
      ],
      video_link: 'https://youtu.be/primaryvideo',
      featured_embed_id: 'embed-1',
    });

    expect(buildOverviewVideoEmbedsPayload([])).toEqual({
      embeds: [],
      video_link: null,
      featured_embed_id: null,
    });
  });
});
