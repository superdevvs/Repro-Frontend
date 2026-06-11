// Property-based + unit test for the Address_Parser street helpers.
//
// Feature: booking-scheduling-fixes, Property 10: Address formatted line and
// tokens are preserved.
//
// Property 10 states: for any autocomplete-selected address, the stored
// formatted line equals the provider's formatted line verbatim, the structured
// fields re-compose to the original token sequence without dropping or merging
// adjacent tokens, and any street suffix remains a distinct space-separated
// token (never concatenated to the preceding word).
//
// These guarantees are realized by the pure helpers added in task 6.1 and
// exported from `AddressLookupField.tsx`:
//   - `parseStreetLine(line)`     -> structured { number, name, suffix, unit }
//   - `formatParsedStreetLine(p)` -> single-spaced re-composition
//
// The street parser operates only on the street segment (the text before the
// first comma); the remainder of the formatted line is preserved verbatim by
// `buildDetailsFromSuggestion` (it copies `formatted_address` directly). This
// test exercises the token-preservation and suffix-distinctness contract on the
// exported pure helpers, plus the canonical `3300 Lake Austin Blvd` example.
//
// Validates: Requirements 7.1, 7.2, 7.3

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { parseStreetLine, formatParsedStreetLine } from '@/components/AddressLookupField';

// Representative subset of the known street suffixes, mapping the abbreviated
// token to its canonical expanded form. The parser keeps the suffix as its own
// distinct token and expands it, never concatenating it to the street name.
const SUFFIX_CASES: Array<{ token: string; expanded: string }> = [
  { token: 'Blvd', expanded: 'Boulevard' },
  { token: 'St', expanded: 'Street' },
  { token: 'Ave', expanded: 'Avenue' },
  { token: 'Rd', expanded: 'Road' },
  { token: 'Dr', expanded: 'Drive' },
  { token: 'Ln', expanded: 'Lane' },
  { token: 'Ct', expanded: 'Court' },
  { token: 'Pkwy', expanded: 'Parkway' },
];

// Street-name words that are NOT themselves suffix keys, so a generated name
// token is never mistaken for a trailing suffix.
const NAME_WORDS = [
  'Lake', 'Austin', 'Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'River',
  'Hill', 'Sunset', 'Willow', 'Madison', 'Lincoln', 'Washington', 'Birch',
];

const streetNumberArb = fc
  .integer({ min: 1, max: 99999 })
  .map((n) => String(n));

const nameWordsArb = fc.array(fc.constantFrom(...NAME_WORDS), {
  minLength: 1,
  maxLength: 3,
});

const suffixArb = fc.constantFrom(...SUFFIX_CASES);

describe('Feature: booking-scheduling-fixes, Property 10: Address formatted line and tokens are preserved', () => {
  it('parses number, name, and suffix as distinct tokens without dropping or merging (Req 7.2, 7.3)', () => {
    fc.assert(
      fc.property(streetNumberArb, nameWordsArb, suffixArb, (number, nameWords, suffix) => {
        const name = nameWords.join(' ');
        const line = `${number} ${name} ${suffix.token}`;

        const parsed = parseStreetLine(line);

        // Number is peeled cleanly off the front.
        expect(parsed.number).toBe(number);
        // Street name is preserved verbatim (every name token, in order).
        expect(parsed.name).toBe(name);
        // Suffix is detected, expanded, and kept distinct from the name.
        expect(parsed.suffix).toBe(suffix.expanded);
      }),
    );
  });

  it('re-composes to the original token sequence with the suffix as a distinct space-separated word (Req 7.2, 7.3)', () => {
    fc.assert(
      fc.property(streetNumberArb, nameWordsArb, suffixArb, (number, nameWords, suffix) => {
        const name = nameWords.join(' ');
        const line = `${number} ${name} ${suffix.token}`;

        const recomposed = formatParsedStreetLine(parseStreetLine(line));
        const tokens = recomposed.split(/\s+/).filter(Boolean);

        // Token sequence: [number, ...nameWords, expandedSuffix] — nothing
        // dropped, nothing merged.
        expect(tokens).toEqual([number, ...nameWords, suffix.expanded]);

        // The suffix is its own trailing token; it is never concatenated to the
        // preceding name word (e.g. never `LakeBoulevard`).
        const lastNameWord = nameWords[nameWords.length - 1];
        expect(recomposed).toContain(`${lastNameWord} ${suffix.expanded}`);
        expect(recomposed).not.toContain(`${lastNameWord}${suffix.expanded}`);
      }),
    );
  });

  it('preserves the street segment verbatim and ignores trailing comma-separated parts (Req 7.1, 7.2)', () => {
    fc.assert(
      fc.property(streetNumberArb, nameWordsArb, suffixArb, (number, nameWords, suffix) => {
        const name = nameWords.join(' ');
        const streetSegment = `${number} ${name} ${suffix.token}`;
        // A full formatted line: street segment plus city/state/zip.
        const fullLine = `${streetSegment}, Austin, TX 78703`;

        const fromStreet = parseStreetLine(streetSegment);
        const fromFull = parseStreetLine(fullLine);

        // Only the street segment drives the structured parse; the city/state/
        // zip tail is ignored, leaving the street tokens identical.
        expect(fromFull).toEqual(fromStreet);
      }),
    );
  });

  it('parses the canonical example `3300 Lake Austin Blvd` correctly (Req 7.3)', () => {
    const parsed = parseStreetLine('3300 Lake Austin Blvd');

    expect(parsed.number).toBe('3300');
    expect(parsed.name).toBe('Lake Austin');
    expect(parsed.suffix).toBe('Boulevard');

    const recomposed = formatParsedStreetLine(parsed);
    expect(recomposed).toBe('3300 Lake Austin Boulevard');
    // The defect this guards against: `Lake` and the suffix must never merge.
    expect(recomposed).not.toContain('LakeBoulevard');
  });
});
