export type OverviewVideoEmbed = {
  id: string;
  title: string;
  url: string;
};

export type OverviewVideoEmbedsPayload = {
  embeds: Array<{
    id: string;
    title: string;
    url: string;
    branded: string;
    branded_embed: string;
    mls: string;
    mls_embed: string;
  }>;
  video_link: string | null;
  featured_embed_id: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

/** @deprecated Privileged roles no longer get Overview Video Tour Embeds; kept empty for import safety. */
export const OVERVIEW_VIDEO_EMBED_WRITE_ROLES = new Set<string>([]);

export const normalizeOverviewRole = (role: string | null | undefined) =>
  String(role ?? '')
    .trim()
    .toLowerCase();

export type CanAccessOverviewVideoEmbedsOptions = {
  /** Assigned via video_editor_id / lane=video on this shoot. */
  isAssignedVideoEditor?: boolean;
  /** editing_capabilities includes video (video-only or dual). */
  hasVideoCapability?: boolean;
  /** Assigned as any editor on this shoot. */
  isAssignedEditor?: boolean;
};

/** @deprecated Use CanAccessOverviewVideoEmbedsOptions. */
export type CanWriteOverviewVideoEmbedsOptions = CanAccessOverviewVideoEmbedsOptions;

/**
 * Video Tour Embeds: video editors only (view === write).
 * role=editor AND (video assignee on shoot OR video-capable + assigned on shoot).
 * Never admin / superadmin / editing_manager / sales / photographer / photo-only.
 */
export const canAccessOverviewVideoEmbeds = (
  role: string | null | undefined,
  options?: CanAccessOverviewVideoEmbedsOptions,
) => {
  if (normalizeOverviewRole(role) !== 'editor') return false;
  if (options?.isAssignedVideoEditor) return true;
  if (options?.hasVideoCapability && options?.isAssignedEditor) return true;
  return false;
};

export const canWriteOverviewVideoEmbeds = canAccessOverviewVideoEmbeds;

/**
 * Same gate as write — section is hidden entirely for non-video editors.
 * Legacy (role, isEditor) signature still accepted: isEditor alone is NOT enough.
 */
export const canViewOverviewVideoEmbeds = (
  role: string | null | undefined,
  isEditorOrOptions: boolean | CanAccessOverviewVideoEmbedsOptions = false,
) => {
  if (typeof isEditorOrOptions === 'boolean') {
    // Boolean isEditor alone no longer grants access (need video assignee / video caps).
    return false;
  }
  return canAccessOverviewVideoEmbeds(role, isEditorOrOptions);
};

export const createOverviewVideoEmbedId = () =>
  `embed-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const resolveOverviewEmbedUrl = (value: unknown) => {
  const embed = asRecord(value);
  return firstString(
    embed.url,
    embed.branded,
    embed.branded_embed,
    embed.mls,
    embed.mls_embed,
  );
};

/**
 * Overview Video Tour Embeds edit the listing video (`video_link`), not Virtual
 * Tours (`tour_links.embeds`). Prefer video_link so Media "Video Embed" and this
 * editor stay aligned; only fall back to embeds when video_link is empty (legacy).
 */
export const normalizeOverviewVideoEmbeds = (
  tourLinks: unknown,
  shootId?: string | number | null,
): OverviewVideoEmbed[] => {
  const links = asRecord(tourLinks);
  const legacyVideoLink = firstString(links.video_link);
  if (legacyVideoLink) {
    return [
      {
        id: `embed-${shootId ?? 'shoot'}-video-link`,
        title: 'Video 1',
        url: legacyVideoLink,
      },
    ];
  }

  const rawEmbeds = Array.isArray(links.embeds) ? links.embeds : [];
  for (let index = 0; index < rawEmbeds.length; index += 1) {
    const embed = asRecord(rawEmbeds[index]);
    const url = resolveOverviewEmbedUrl(embed);
    if (!url) continue;
    return [
      {
        id: firstString(embed.id) || `embed-${shootId ?? 'shoot'}-${index}`,
        title: firstString(embed.title) || 'Video 1',
        url,
      },
    ];
  }

  return [];
};

export const buildOverviewVideoEmbedsPayload = (
  embeds: OverviewVideoEmbed[],
  _featuredEmbedId?: string | null,
): OverviewVideoEmbedsPayload => {
  const primary = embeds.map((embed) => ({
    ...embed,
    url: embed.url.trim(),
    title: embed.title.trim(),
  })).find((embed) => Boolean(embed.url));

  const url = primary?.url ?? null;

  // Do not mirror listing video into Virtual Tours embeds[]. Video Tour owns
  // video_link; Tour-tab Embeds manage 3D/Matterport-style Virtual Tours.
  return {
    embeds: [],
    video_link: url,
    featured_embed_id: null,
  };
};


/**
 * Assigned video editors may only PATCH these tour_links keys (BE UpdateShootAction
 * $editorEditableTourLinkKeys). Spreading the full tour_links blob echoes
 * property_description / video_branded / etc. and returns 403.
 */
export const EDITOR_TOUR_LINK_EMBED_KEYS = [
  'embeds',
  'video_link',
  'featured_embed_id',
  'featured_embed',
] as const;

export type EditorTourLinksEmbedPatch = {
  embeds: OverviewVideoEmbedsPayload['embeds'];
  video_link: string | null;
  featured_embed_id: string | null;
  featured_embed?: string | null;
};

export const buildEditorTourLinksEmbedPatch = (input: {
  embeds: OverviewVideoEmbedsPayload['embeds'];
  video_link: string | null;
  featured_embed_id: string | null;
  featured_embed?: string | null;
}): EditorTourLinksEmbedPatch => {
  const patch: EditorTourLinksEmbedPatch = {
    embeds: input.embeds,
    video_link: input.video_link,
    featured_embed_id: input.featured_embed_id,
  };
  if (input.featured_embed !== undefined) {
    patch.featured_embed = input.featured_embed;
  }
  return patch;
};

export const isValidHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());
