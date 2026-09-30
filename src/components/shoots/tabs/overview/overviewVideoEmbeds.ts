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

export const OVERVIEW_VIDEO_EMBED_WRITE_ROLES = new Set([
  'admin',
  'superadmin',
  'super_admin',
  'editing_manager',
]);

export const normalizeOverviewRole = (role: string | null | undefined) =>
  String(role ?? '')
    .trim()
    .toLowerCase();

export type CanWriteOverviewVideoEmbedsOptions = {
  /** True when role=editor and the auth user is assigned on this shoot (editor_id or video_editor_id). */
  isAssignedEditor?: boolean;
};

/**
 * Privileged roles always write. role=editor may write only when assigned on the shoot
 * (BE PATCH allows tour_links.embeds | video_link | featured_embed(_id) for assignees).
 */
export const canWriteOverviewVideoEmbeds = (
  role: string | null | undefined,
  options?: CanWriteOverviewVideoEmbedsOptions,
) => {
  const normalized = normalizeOverviewRole(role);
  if (OVERVIEW_VIDEO_EMBED_WRITE_ROLES.has(normalized)) return true;
  if (normalized === 'editor' && Boolean(options?.isAssignedEditor)) return true;
  return false;
};

/** Privileged writers + editors who already can open the shoot. */
export const canViewOverviewVideoEmbeds = (
  role: string | null | undefined,
  isEditor = false,
) => canWriteOverviewVideoEmbeds(role) || Boolean(isEditor);

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
