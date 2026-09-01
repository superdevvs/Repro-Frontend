import { API_BASE_URL } from '@/config/env';

export type PublicTourVariant = 'branded' | 'mls' | 'generic-mls';

export const resolvePublicTourVariantFromPath = (pathname: string): PublicTourVariant => {
  if (pathname.includes('/branded')) return 'branded';
  if (pathname.includes('/g-mls')) return 'generic-mls';
  return 'mls';
};

type LooseRecord = Record<string, unknown>;

const asRecord = (value: unknown): LooseRecord =>
  value && typeof value === 'object' ? value as LooseRecord : {};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const normalizePublicTourUrl = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const baseUrl = API_BASE_URL || fallbackOrigin;
    const url = new URL(value.trim(), `${baseUrl.replace(/\/$/, '')}/`);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

export type PublicIguideSources = {
  expiresAt: string;
  inlineUrl: string;
  openUrl: string;
  source: string;
};

export type PublicEmbedSources = {
  branded: string;
  mls: string;
};

/** MLS surfaces must never recover a missing unbranded embed from a branded URL. */
export const resolvePublicEmbedSources = (
  value: unknown,
  variant: PublicTourVariant,
): PublicEmbedSources => {
  const embed = asRecord(value);
  const mls = firstString(embed.mls, embed.mls_embed);
  if (variant !== 'branded') return { branded: '', mls };

  return {
    branded: firstString(embed.branded, embed.branded_embed, embed.url),
    mls,
  };
};

/**
 * Mirrors ShootPublicAssetsService. MLS accepts only the server-filtered
 * unbranded legacy field, while the canonical nested viewer is safe for the
 * public route variant that returned it.
 */
export const resolvePublicIguideSources = (
  payload: unknown,
  variant: PublicTourVariant,
): PublicIguideSources => {
  const root = asRecord(payload);
  const links = asRecord(root.tour_links ?? root.tourLinks);
  const viewer = asRecord(root.iguide_viewer ?? root.iguideViewer);
  const nestedInlineUrl = normalizePublicTourUrl(
    firstString(viewer.inline_url, viewer.inlineUrl),
  );
  const nestedOpenUrl = normalizePublicTourUrl(
    firstString(viewer.open_url, viewer.openUrl),
  );

  // The public-assets endpoint canonicalizes provider/manual links and uploaded
  // packages into this viewer object. Prefer it so inline and external URLs can
  // be signed independently without any browser-side authentication fallback.
  if (Object.keys(viewer).length > 0) {
    return {
      expiresAt: firstString(viewer.expires_at, viewer.expiresAt),
      inlineUrl: nestedInlineUrl || nestedOpenUrl,
      openUrl: nestedOpenUrl || nestedInlineUrl,
      source: firstString(viewer.source),
    };
  }

  // Compatibility for public responses deployed before iguide_viewer. MLS and
  // generic MLS deliberately read only server-filtered unbranded fields.
  const legacyUrl = variant !== 'branded'
    ? firstString(root.iguide_tour_url, root.iguide_url, links.iguide_mls)
    : firstString(
        root.iguide_tour_url,
        root.iguide_url,
        links.iguide_branded,
        links.iGuide,
        links.iguide,
        links.iguide_mls,
      );
  const normalizedLegacyUrl = normalizePublicTourUrl(legacyUrl);

  return {
    expiresAt: '',
    inlineUrl: normalizedLegacyUrl,
    openUrl: normalizedLegacyUrl,
    source: normalizedLegacyUrl ? 'legacy_public_url' : '',
  };
};
