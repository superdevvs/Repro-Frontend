/**
 * Boundary-only timezone normalization (Req 12.4, 12.5, 12.6).
 *
 * `Asia/Calcutta` is the deprecated alias of `Asia/Kolkata`. Both name the same
 * IANA zone, so scheduling behavior must treat them as equal. These helpers are
 * applied ONLY at application boundaries (data entering/leaving the app) and
 * during comparison or display.
 *
 * They MUST NOT be used to rewrite stored dates/times: stored timezone values are
 * left exactly as persisted. `Asia/Kolkata` is used as the canonical identifier
 * for NEW writes only, while `Asia/Calcutta` continues to be accepted as an alias
 * on read/compare. Because normalization only maps an alias to its canonical name
 * (never converts wall-clock time), it cannot shift any stored time.
 */

/** Canonical IANA identifier preferred for new writes. */
export const CANONICAL_TIMEZONE = 'Asia/Kolkata' as const;

/**
 * Map of deprecated/aliased IANA timezone identifiers to their canonical name.
 * Comparison is case-insensitive on lookup.
 */
const TIMEZONE_ALIASES: Readonly<Record<string, string>> = {
  'asia/calcutta': CANONICAL_TIMEZONE,
};

/**
 * Normalize a named timezone to its canonical IANA identifier for comparison or
 * display. Maps `Asia/Calcutta` -> `Asia/Kolkata` and leaves all other values
 * untouched (aside from trimming surrounding whitespace).
 *
 * This is a pure, boundary-only transform. It never mutates stored values; callers
 * use the returned name only for comparison, display, or as the identifier for a
 * new write. Null/empty/undefined inputs are returned unchanged (after trimming),
 * so the helper never throws.
 */
export function normalizeTimezone(name?: string | null): string {
  if (name == null) return '';
  const trimmed = String(name).trim();
  if (trimmed === '') return '';
  const canonical = TIMEZONE_ALIASES[trimmed.toLowerCase()];
  return canonical ?? trimmed;
}

/**
 * Determine whether two named timezones refer to the same zone, treating accepted
 * aliases (e.g. `Asia/Calcutta` and `Asia/Kolkata`) as equal. Comparison is
 * boundary-only and does not read or modify any stored value.
 */
export function isSameTimezone(a?: string | null, b?: string | null): boolean {
  return normalizeTimezone(a) === normalizeTimezone(b);
}
