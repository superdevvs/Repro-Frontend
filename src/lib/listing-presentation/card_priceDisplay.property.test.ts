// Property-based test for `priceDisplay` (sidebar card price label).
//
// Feature: map-tab-ui-improvements, Property 4: Price display reflects price
// presence.
//
// For any price (undefined / 0 / negative / NaN / Infinity / positive / very
// large), `priceDisplay` returns the formatted price when the price is a
// positive finite number, and returns a non-empty fallback label for any
// missing / zero / negative / non-finite price.
//
// Validates: Requirements 3.3, 3.4

import fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import { priceDisplay, PRICE_FALLBACK_LABEL } from './card'

/** Oracle: a present, positive, finite number. */
function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Prices spanning the full edge-case matrix. */
const arbitraryPrice: fc.Arbitrary<number | undefined | null> = fc.oneof(
  fc.constant<number | undefined | null>(undefined),
  fc.constant<number | undefined | null>(null),
  fc.constant(0),
  fc.constant(-0),
  fc.integer({ min: -1_000_000, max: -1 }),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
  fc.integer({ min: 1, max: 5_000_000 }),
  fc.constant(1_000_000_000_000),
  fc.double({ min: 1e-6, max: 1e15, noNaN: true, noDefaultInfinity: true }).filter((n) => n > 0),
)

/**
 * A formatter that returns a known non-empty string for positive input. We also
 * exercise formatters that return blank for positive input: in that case the
 * implementation must still fall back to the (non-empty) fallback label rather
 * than returning a blank price.
 */
type FormatCase = {
  format: (p?: number | null) => string
  /** Whether `format` yields a non-blank string for a positive price. */
  positiveIsNonBlank: boolean
  /** Compute the expected formatted output for a positive price. */
  formatted: (p: number) => string
}

const arbitraryFormat: fc.Arbitrary<FormatCase> = fc.oneof(
  // Normal currency-ish formatter — always non-blank for positive input.
  fc.constant<FormatCase>({
    format: (p) => `$${Number(p).toLocaleString()}`,
    positiveIsNonBlank: true,
    formatted: (p) => `$${Number(p).toLocaleString()}`,
  }),
  // Fixed sentinel string.
  fc.constant<FormatCase>({
    format: () => 'PRICED',
    positiveIsNonBlank: true,
    formatted: () => 'PRICED',
  }),
  // Degenerate formatter that returns blank even for positive input: the
  // implementation must then use the fallback label.
  fc.constantFrom('', '   ').map<FormatCase>((blank) => ({
    format: () => blank,
    positiveIsNonBlank: false,
    formatted: () => blank,
  })),
)

describe('Feature: map-tab-ui-improvements, Property 4: Price display reflects price presence', () => {
  it('formats positive finite prices and returns the fallback exactly otherwise', () => {
    fc.assert(
      fc.property(arbitraryPrice, arbitraryFormat, (price, formatCase) => {
        const result = priceDisplay(price, formatCase.format)

        // Result is always a non-empty string.
        expect(typeof result).toBe('string')
        expect(result.trim().length).toBeGreaterThan(0)

        if (isPositiveFinite(price) && formatCase.positiveIsNonBlank) {
          // Positive finite price + non-blank formatter -> the formatted price.
          expect(result).toBe(formatCase.formatted(price))
        } else {
          // Missing / zero / negative / non-finite (or blank-format) -> fallback.
          expect(result).toBe(PRICE_FALLBACK_LABEL)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('returns the fallback label exactly for every non-positive / non-finite / missing price', () => {
    const nonPositive: Array<number | undefined | null> = [
      undefined,
      null,
      0,
      -0,
      -1,
      -1000,
      NaN,
      Infinity,
      -Infinity,
    ]
    fc.assert(
      fc.property(fc.constantFrom(...nonPositive), (price) => {
        // Even with a perfectly good formatter, a non-positive price -> fallback.
        const result = priceDisplay(price, (p) => `$${Number(p).toLocaleString()}`)
        expect(result).toBe(PRICE_FALLBACK_LABEL)
        expect(result.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 },
    )
  })
})
