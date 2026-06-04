// Property-based test for `resolveCardImage` (sidebar card image resolution).
//
// Feature: map-tab-ui-improvements, Property 2: Card image always resolves to a
// non-empty source.
//
// For any heroImage value (including undefined / empty / whitespace-only) and
// any resolve function (identity-ish, constant, null/blank-returning, or
// throwing), `resolveCardImage` returns a non-empty string, and returns exactly
// the (sanitized) placeholder whenever the resolved value is blank.
//
// Validates: Requirements 3.1

import fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import { resolveCardImage, DEFAULT_PLACEHOLDER_IMAGE } from './card'
import { arbitraryListing } from './test-arbitraries'

/** Mirror of the module-private blank check: null/undefined or whitespace-only. */
function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0
}

type ResolverCase = {
  /** The resolve function passed to `resolveCardImage`. */
  resolve: (v?: string | null) => string | null
  /** Oracle: what the resolved value is for a given heroImage (null === blank/throw). */
  resolvedFor: (hero: string | null | undefined) => string | null
}

/**
 * A spread of resolve functions: identity, always-null, always-blank, a
 * constant non-blank value, and a throwing resolver (which the implementation
 * must treat as a blank result and fall back to the placeholder).
 */
const arbitraryResolver: fc.Arbitrary<ResolverCase> = fc.oneof(
  // Identity-ish: echoes the heroImage (possibly blank/undefined).
  fc.constant<ResolverCase>({
    resolve: (v) => v ?? null,
    resolvedFor: (hero) => hero ?? null,
  }),
  // Always returns null.
  fc.constant<ResolverCase>({
    resolve: () => null,
    resolvedFor: () => null,
  }),
  // Always returns a blank / whitespace-only string.
  fc.constantFrom('', '   ', '\t', '\n  ').map<ResolverCase>((blank) => ({
    resolve: () => blank,
    resolvedFor: () => blank,
  })),
  // Always returns a fixed non-blank string.
  fc
    .string({ minLength: 1 })
    .filter((s) => s.trim().length > 0)
    .map<ResolverCase>((val) => ({
      resolve: () => val,
      resolvedFor: () => val,
    })),
  // Throws — implementation must catch and fall back to the placeholder.
  fc.constant<ResolverCase>({
    resolve: () => {
      throw new Error('resolve failure')
    },
    resolvedFor: () => null,
  }),
)

type PlaceholderOpt = { pass: boolean; value?: string }

/**
 * Either omit the placeholder argument (exercising the default) or pass one of
 * a mix of blank and non-blank placeholder strings.
 */
const arbitraryPlaceholderOpt: fc.Arbitrary<PlaceholderOpt> = fc.oneof(
  fc.constant<PlaceholderOpt>({ pass: false }),
  fc.string().map<PlaceholderOpt>((value) => ({ pass: true, value })),
  fc.constantFrom('', '   ', '\t').map<PlaceholderOpt>((value) => ({ pass: true, value })),
  fc.webUrl().map<PlaceholderOpt>((value) => ({ pass: true, value })),
)

describe('Feature: map-tab-ui-improvements, Property 2: Card image always resolves to a non-empty source', () => {
  it('returns a non-empty source and exactly the placeholder when the resolved value is blank', () => {
    fc.assert(
      fc.property(
        arbitraryListing,
        arbitraryResolver,
        arbitraryPlaceholderOpt,
        (listing, resolverCase, placeholderOpt) => {
          const hero = listing.heroImage

          const result = placeholderOpt.pass
            ? resolveCardImage(hero, resolverCase.resolve, placeholderOpt.value)
            : resolveCardImage(hero, resolverCase.resolve)

          // The placeholder the implementation should fall back to: a supplied
          // non-blank placeholder, otherwise the default.
          const suppliedPlaceholder = placeholderOpt.pass
            ? (placeholderOpt.value as string)
            : DEFAULT_PLACEHOLDER_IMAGE
          const safePlaceholder = isBlank(suppliedPlaceholder)
            ? DEFAULT_PLACEHOLDER_IMAGE
            : suppliedPlaceholder

          // Always a non-empty string.
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(0)

          const resolved = resolverCase.resolvedFor(hero)
          if (isBlank(resolved)) {
            // Blank resolution -> exactly the (sanitized) placeholder.
            expect(result).toBe(safePlaceholder)
          } else {
            // Non-blank resolution -> exactly the resolved value.
            expect(result).toBe(resolved)
          }
        },
      ),
      { numRuns: 200 },
    )
  })
})
