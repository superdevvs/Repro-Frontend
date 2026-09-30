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
 * Prefer tour_links.embeds. If empty, seed a single row from video_link so editors
 * still see the primary tour video already stored for backward-compat rendering.
 */
export const normalizeOverviewVideoEmbeds = (
  tourLinks: unknown,
  shootId?: string | number | null,
): OverviewVideoEmbed[] => {
  const links = asRecord(tourLinks);
  const rawEmbeds = Array.isArray(links.embeds) ? links.embeds : [];
  const embeds = rawEmbeds
    .map((item, index) => {
      const embed = asRecord(item);
      const url = resolveOverviewEmbedUrl(embed);
      if (!url) return null;
      return {
        id: firstString(embed.id) || `embed-${shootId ?? 'shoot'}-${index}`,
        title: firstString(embed.title) || `Video ${index + 1}`,
        url,
      } satisfies OverviewVideoEmbed;
    })
    .filter((embed): embed is OverviewVideoEmbed => Boolean(embed));

  if (embeds.length > 0) return embeds;

  const legacyVideoLink = firstString(links.video_link);
  if (!legacyVideoLink) return [];

  return [
    {
      id: `embed-${shootId ?? 'shoot'}-video-link`,
      title: 'Video 1',
      url: legacyVideoLink,
    },
  ];
};

export const buildOverviewVideoEmbedsPayload = (
  embeds: OverviewVideoEmbed[],
  featuredEmbedId?: string | null,
): OverviewVideoEmbedsPayload => {
  const normalized = embeds
    .map((embed, index) => {
      const url = embed.url.trim();
      if (!url) return null;
      const id = embed.id.trim() || createOverviewVideoEmbedId();
      const title = embed.title.trim() || `Video ${index + 1}`;
      return {
        id,
        title,
        url,
        // Mirror url into branded/mls fields so existing tour renderers keep working
        // until they fully consume the shared `url` shape.
        branded: url,
        branded_embed: url,
        mls: url,
        mls_embed: url,
      };
    })
    .filter((embed): embed is OverviewVideoEmbedsPayload['embeds'][number] => Boolean(embed));

  const featured =
    (featuredEmbedId && normalized.some((embed) => embed.id === featuredEmbedId)
      ? featuredEmbedId
      : normalized[0]?.id) ?? null;

  return {
    embeds: normalized,
    video_link: normalized[0]?.url ?? null,
    featured_embed_id: featured,
  };
};

export const isValidHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());
