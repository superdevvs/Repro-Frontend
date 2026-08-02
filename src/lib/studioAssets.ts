/**
 * Studio generated-asset resolution (ai-editing-studio-revamp).
 *
 * Every image-bearing Studio region (Hero_Preview, Workflow_Card, Live_Queue
 * thumbnail, Recent_Projects, shoot thumbnail) renders a **stored application
 * asset** rather than a remote temporary URL (Req 2.7, 5.8, 17.10). This module
 * is the single place that decides whether a reference is an
 * application-controlled asset path, so the rule holds identically everywhere.
 *
 * A reference is accepted when it resolves to a path served by the application
 * itself (either already root-relative, or relative to the Studio asset
 * directory). Anything carrying a URL scheme (`https:`, `data:`, `blob:`) or a
 * protocol-relative host (`//host/...`), and anything trying to escape the
 * asset directory (`..`), is rejected — callers then render their defined
 * placeholder/skeleton fallback instead.
 */

/** Directory (served by the app) holding downloaded Generated_Property_Images. */
export const STUDIO_ASSET_BASE_PATH = '/studio-assets';

/** Matches any absolute URL scheme, e.g. `https:`, `data:`, `blob:`, `file:`. */
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/**
 * True when `candidate` is a path served by this application.
 *
 * Root-relative single-slash paths only: protocol-relative (`//host`) and
 * scheme-qualified references point at another origin.
 */
export function isApplicationAssetPath(candidate: string): boolean {
  if (typeof candidate !== 'string') return false;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (URL_SCHEME_PATTERN.test(trimmed)) return false;
  return !hasTraversalSegment(trimmed);
}

/**
 * Resolve a stored asset reference (as recorded in `generated_assets.asset_path`)
 * to an application-controlled path, or `null` when it cannot be served by the
 * application and the region must fall back to its placeholder.
 */
export function resolveStudioAssetPath(reference?: string | null): string | null {
  if (typeof reference !== 'string') return null;

  const trimmed = reference.trim();
  if (!trimmed) return null;
  if (URL_SCHEME_PATTERN.test(trimmed)) return null;
  if (trimmed.startsWith('//')) return null;

  const withoutLeadingDot = trimmed.replace(/^\.\/+/, '');
  if (!withoutLeadingDot) return null;
  if (hasTraversalSegment(withoutLeadingDot)) return null;

  const path = withoutLeadingDot.startsWith('/')
    ? withoutLeadingDot
    : `${STUDIO_ASSET_BASE_PATH}/${withoutLeadingDot}`;

  const normalized = path.replace(/\/{2,}/g, '/');
  return isApplicationAssetPath(normalized) ? normalized : null;
}

function hasTraversalSegment(path: string): boolean {
  return path.split('/').some((segment) => segment === '..');
}

export interface StudioGeneratedAssetManifestEntry {
  instructionIndex: number;
  placement: string;
  path: string;
  alt: string;
}

/**
 * The incorporated asset manifest is kept alongside resolution so every
 * image-bearing region has a deterministic application path and useful text
 * alternative. The JSON copy in `public/studio-assets/manifest.json` records
 * the same metadata for operational hand-off.
 */
export const STUDIO_GENERATED_ASSET_MANIFEST = [
  {
    instructionIndex: 1,
    placement: 'hero-before',
    path: 'hero-before.webp',
    alt: 'Contemporary luxury home before AI twilight enhancement',
  },
  {
    instructionIndex: 2,
    placement: 'hero-after',
    path: 'hero-after.webp',
    alt: 'The same contemporary luxury home after AI twilight enhancement',
  },
  {
    instructionIndex: 3,
    placement: 'selected-shoot',
    path: 'selected-shoot.webp',
    alt: 'Selected modern suburban property',
  },
  {
    instructionIndex: 4,
    placement: 'queue-photo-enhancement',
    path: 'queue-photo-enhancement.webp',
    alt: 'Bright open-plan living room queued for photo enhancement',
  },
  {
    instructionIndex: 5,
    placement: 'queue-twilight',
    path: 'queue-twilight.webp',
    alt: 'Modern luxury residence queued for twilight conversion',
  },
  {
    instructionIndex: 6,
    placement: 'queue-video-cleanup',
    path: 'queue-video-cleanup.webp',
    alt: 'Open-plan interior queued for video cleanup',
  },
  {
    instructionIndex: 7,
    placement: 'workflow-photo-enhancement',
    path: 'workflow-photo-enhancement.webp',
    alt: 'Enhanced luxury living room',
  },
  {
    instructionIndex: 8,
    placement: 'workflow-twilight',
    path: 'workflow-twilight.webp',
    alt: 'Modern luxury home at twilight',
  },
  {
    instructionIndex: 9,
    placement: 'workflow-video-cleanup',
    path: 'workflow-video-cleanup.webp',
    alt: 'Polished luxury kitchen walkthrough frame',
  },
  {
    instructionIndex: 10,
    placement: 'workflow-listing-video',
    path: 'workflow-listing-video.webp',
    alt: 'Cinematic luxury home listing video frame',
  },
  {
    instructionIndex: 11,
    placement: 'workflow-reel-generator',
    path: 'workflow-reel-generator.webp',
    alt: 'Smartphone showing a vertical property reel',
  },
  {
    instructionIndex: 12,
    placement: 'workflow-batch-ai-jobs',
    path: 'workflow-batch-ai-jobs.webp',
    alt: 'Six luxury property photos prepared for batch processing',
  },
] as const satisfies readonly StudioGeneratedAssetManifestEntry[];

/** Placement → stored asset reference for the generated Studio images. */
export const STUDIO_GENERATED_ASSET_REFS: Record<string, string | null> =
  Object.fromEntries(
    STUDIO_GENERATED_ASSET_MANIFEST.map(({ placement, path }) => [placement, path]),
  );

/** Resolve a placement's assigned asset, or `null` while none is assigned. */
export function resolveGeneratedAsset(placement: string): string | null {
  return resolveStudioAssetPath(STUDIO_GENERATED_ASSET_REFS[placement] ?? null);
}
