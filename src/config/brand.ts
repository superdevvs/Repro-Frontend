/**
 * Single source of truth for how the company is named and contacted in
 * user-facing output.
 *
 * The invoice screens and PDF previously hardcoded `REPRO Photos` while the
 * legal pages, terms and emails used `R/E Pro Photos`, so the same document
 * could present two different company names. Anything a client or payee sees
 * should import from here rather than re-declaring a literal.
 */

/** The company name exactly as it should be rendered. */
export const BRAND_NAME = 'R/E Pro Photos';

export const BRAND_PHONE = '(202) 868-1663';

export const BRAND_EMAIL = 'contact@reprophotos.com';

/** Path to the logo asset served from `public/`. */
export const BRAND_LOGO_SRC = '/REPRO-HQ.svg';

/**
 * Optional multi-line postal address, configured per environment as a
 * pipe-separated string (e.g. `"Suite 100|Rockville, MD 20850"`).
 */
export const BRAND_ADDRESS_LINES: string[] = (() => {
  const raw = import.meta.env.VITE_COMPANY_ADDRESS?.trim();
  if (!raw) return [];
  return raw
    .split('|')
    .map((line) => line.trim())
    .filter(Boolean);
})();
