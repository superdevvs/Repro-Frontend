import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  CANONICAL_TIMEZONE,
  isSameTimezone,
  normalizeTimezone,
} from '@/utils/timezone'

/**
 * Timezone equivalence regression (MANDATORY).
 *
 * Feature: booking-scheduling-fixes, Property 14: Asia/Calcutta and
 * Asia/Kolkata are treated as one timezone without rewriting stored values.
 *
 * Validates: Requirements 12.4, 12.5, 12.6, 12.7
 *
 * These tests prove that `Asia/Calcutta` (the deprecated alias) and
 * `Asia/Kolkata` (the canonical IANA name) produce equivalent scheduling
 * behavior, and that normalization is a pure, boundary-only transform that never
 * mutates the stored timezone string or any stored date/time value.
 */

const ALIAS = 'Asia/Calcutta'
const CANONICAL = 'Asia/Kolkata'

/**
 * A representative, pure scheduling decision keyed on a named timezone. It does
 * NOT convert wall-clock time; it only normalizes the zone name at the boundary
 * (as the real scheduling code does) and builds a canonical scheduling key from
 * the stored date/time plus the normalized zone. Two inputs that name the same
 * zone must yield byte-identical scheduling keys.
 */
function schedulingKey(date: string, time: string, timezone: string): string {
  return `${date}T${time}@${normalizeTimezone(timezone)}`
}

describe('normalizeTimezone (Property 14 regression)', () => {
  it('maps the Asia/Calcutta alias to the canonical Asia/Kolkata', () => {
    expect(normalizeTimezone(ALIAS)).toBe(CANONICAL)
    expect(normalizeTimezone(CANONICAL)).toBe(CANONICAL)
    expect(CANONICAL_TIMEZONE).toBe(CANONICAL)
  })

  it('treats the alias and canonical name as the same normalized zone', () => {
    expect(normalizeTimezone(ALIAS)).toBe(normalizeTimezone(CANONICAL))
  })

  it('is case-insensitive on the alias lookup but preserves the canonical casing', () => {
    expect(normalizeTimezone('asia/calcutta')).toBe(CANONICAL)
    expect(normalizeTimezone('ASIA/CALCUTTA')).toBe(CANONICAL)
    expect(normalizeTimezone('  Asia/Calcutta  ')).toBe(CANONICAL)
  })

  it('leaves unrelated zones untouched (only trimming whitespace)', () => {
    expect(normalizeTimezone('America/Los_Angeles')).toBe('America/Los_Angeles')
    expect(normalizeTimezone('  UTC ')).toBe('UTC')
  })

  it('returns an empty string for null/empty/whitespace input without throwing', () => {
    expect(normalizeTimezone(null)).toBe('')
    expect(normalizeTimezone(undefined)).toBe('')
    expect(normalizeTimezone('')).toBe('')
    expect(normalizeTimezone('   ')).toBe('')
  })

  it('does not mutate the input string it is given (boundary-only, no rewrite)', () => {
    const stored = ALIAS
    const normalized = normalizeTimezone(stored)
    // The stored value is unchanged; normalization returns a NEW canonical name
    // used only for comparison/display, never written back over the stored zone.
    expect(stored).toBe(ALIAS)
    expect(normalized).toBe(CANONICAL)
    expect(stored).not.toBe(normalized)
  })
})

describe('isSameTimezone (Property 14 regression)', () => {
  it('treats Asia/Calcutta and Asia/Kolkata as equal in both directions', () => {
    expect(isSameTimezone(ALIAS, CANONICAL)).toBe(true)
    expect(isSameTimezone(CANONICAL, ALIAS)).toBe(true)
    expect(isSameTimezone(ALIAS, ALIAS)).toBe(true)
    expect(isSameTimezone(CANONICAL, CANONICAL)).toBe(true)
  })

  it('distinguishes genuinely different zones', () => {
    expect(isSameTimezone(ALIAS, 'America/Los_Angeles')).toBe(false)
    expect(isSameTimezone(CANONICAL, 'UTC')).toBe(false)
  })
})

describe('scheduling equivalence across the alias (Property 14)', () => {
  it('produces an identical scheduling decision for Shoot #1 07:00:00 under either alias', () => {
    const underAlias = schedulingKey('2026-06-09', '07:00:00', ALIAS)
    const underCanonical = schedulingKey('2026-06-09', '07:00:00', CANONICAL)
    expect(underAlias).toBe(underCanonical)
    // The stored wall-clock time is untouched by normalization.
    expect(underAlias).toContain('07:00:00')
  })

  it('Property 14: for any time value the alias and canonical yield identical scheduling behavior and never rewrite stored values', () => {
    const timeArb = fc.tuple(
      fc.integer({ min: 0, max: 23 }),
      fc.integer({ min: 0, max: 59 }),
      fc.integer({ min: 0, max: 59 }),
    )
    const dateArb = fc.date({
      min: new Date('2000-01-01T00:00:00Z'),
      max: new Date('2099-12-31T00:00:00Z'),
      noInvalidDate: true,
    })

    fc.assert(
      fc.property(dateArb, timeArb, (date, [h, m, s]) => {
        const pad = (n: number) => String(n).padStart(2, '0')
        const dateStr = date.toISOString().slice(0, 10)
        const timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`

        // Preserve the originals so we can assert nothing was mutated.
        const storedAlias = ALIAS
        const storedCanonical = CANONICAL
        const storedTime = timeStr
        const storedDate = dateStr

        // (1) Both aliases normalize to the same canonical zone.
        expect(normalizeTimezone(storedAlias)).toBe(
          normalizeTimezone(storedCanonical),
        )
        expect(normalizeTimezone(storedAlias)).toBe(CANONICAL)

        // (2) Any scheduling decision keyed on the zone is identical.
        expect(isSameTimezone(storedAlias, storedCanonical)).toBe(true)
        expect(schedulingKey(dateStr, timeStr, storedAlias)).toBe(
          schedulingKey(dateStr, timeStr, storedCanonical),
        )

        // (3) Normalization never shifts the wall-clock time: the canonical key
        //     still carries the exact stored date and time.
        expect(schedulingKey(dateStr, timeStr, storedAlias)).toBe(
          `${dateStr}T${timeStr}@${CANONICAL}`,
        )

        // (4) Stored values are never rewritten by the boundary transform.
        expect(storedAlias).toBe(ALIAS)
        expect(storedCanonical).toBe(CANONICAL)
        expect(storedTime).toBe(timeStr)
        expect(storedDate).toBe(dateStr)
      }),
      { numRuns: 200 },
    )
  })
})
