// Property-based + unit tests for the run-id data factory (`data-factory.ts`).
//
// Feature: photographer-onboarding-qa, Property 6: Run-id suffixing of generated data.
//
// For ANY run id and ANY base label, every identifier produced by the data factory
// (name, email, address) carries that run id as a suffix, and `belongsToRun` returns true for
// EXACTLY those identifiers produced with the current run id (and false for values produced with
// a different run id). The suffix-carrying check is enforced both structurally (the value ends
// with the expected suffix token / the email local part ends with it) and behaviorally (the
// factory's own `belongsToRun` recognizes its own output and rejects another run's output).
//
// Validates: Requirements 1.7, 5.1, 5.2, 19.1

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createDataFactory } from './data-factory';

const EMAIL_DOMAIN = 'example.test';

/**
 * Fixed-length, digit-only run ids. Equal length + digit-only guarantees that one run id can
 * never be a proper suffix of another, so a different run id's suffix token can never be mistaken
 * for the current run's suffix token. This mirrors the sibling entity-tracker property test and
 * gives the "different run does NOT match" half of the property real teeth.
 */
const runIdArb = fc.integer({ min: 0, max: 999_999 }).map((n) => String(n).padStart(6, '0'));

/**
 * Base labels model the realistic input space for the factory: QA persona/entity labels. These
 * never contain an `@` (the factory reserves `@` as the email local/domain separator and detects
 * the email suffix by splitting on the FIRST `@`), so the generator constrains bases to that
 * space — arbitrary `@`-free text plus a set of concrete persona/entity bases. Spaces, dots, and
 * digits in the base are still exercised.
 */
const baseArb = fc.oneof(
  fc
    .string({ minLength: 1, maxLength: 24 })
    .map((s) => s.replace(/@/g, ''))
    .filter((s) => s.length > 0),
  fc.constantFrom(
    'client.qa',
    'admin.qa',
    'photographer.qa',
    'Photographer A',
    'equipment',
    'base-location',
    'invoice',
    'shoot',
  ),
);

describe("Feature: photographer-onboarding-qa, Property 6: Run-id suffixing of generated data", () => {
  it('suffixes every generated identifier with the run id and recognizes exactly its own run', () => {
    fc.assert(
      fc.property(
        runIdArb,
        // Offset guarantees a DIFFERENT run id without discarding generated values.
        fc.integer({ min: 1, max: 999_999 }),
        baseArb,
        (runId, offset, base) => {
          const otherRunId = String((Number(runId) + offset) % 1_000_000).padStart(6, '0');
          // The offset range (1..999_999) guarantees inequality modulo 1_000_000.
          expect(otherRunId).not.toBe(runId);

          const factory = createDataFactory(runId);
          const otherFactory = createDataFactory(otherRunId);

          const name = factory.name(base);
          const email = factory.email(base);
          const address = factory.address(base);

          // --- Structural: every identifier carries the run id as a suffix ---
          // Name and address carry the run id as a trailing space-delimited token.
          expect(name.endsWith(` ${runId}`)).toBe(true);
          expect(address.endsWith(` ${runId}`)).toBe(true);
          // Email carries the run id in the local part, preserving a valid local@domain shape.
          const atIndex = email.indexOf('@');
          expect(atIndex).toBeGreaterThan(0);
          const localPart = email.slice(0, atIndex);
          const domainPart = email.slice(atIndex + 1);
          expect(localPart.endsWith(`.${runId}`)).toBe(true);
          expect(domainPart).toBe(EMAIL_DOMAIN);

          // --- Behavioral: belongsToRun is true for EXACTLY this run's identifiers ---
          expect(factory.belongsToRun(name)).toBe(true);
          expect(factory.belongsToRun(email)).toBe(true);
          expect(factory.belongsToRun(address)).toBe(true);

          // A different run's factory must NOT recognize this run's identifiers...
          expect(otherFactory.belongsToRun(name)).toBe(false);
          expect(otherFactory.belongsToRun(email)).toBe(false);
          expect(otherFactory.belongsToRun(address)).toBe(false);

          // ...and this run's factory must NOT recognize the other run's identifiers.
          expect(factory.belongsToRun(otherFactory.name(base))).toBe(false);
          expect(factory.belongsToRun(otherFactory.email(base))).toBe(false);
          expect(factory.belongsToRun(otherFactory.address(base))).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('produces the documented suffix shapes for a concrete run id and base', () => {
    const factory = createDataFactory('424242');

    expect(factory.name('Photographer A')).toBe('Photographer A 424242');
    expect(factory.address('123 Main St')).toBe('123 Main St 424242');
    expect(factory.email('client.qa')).toBe('client.qa.424242@example.test');

    expect(factory.belongsToRun('Photographer A 424242')).toBe(true);
    expect(factory.belongsToRun('client.qa.424242@example.test')).toBe(true);
    expect(factory.belongsToRun('client.qa.999999@example.test')).toBe(false);
    expect(factory.belongsToRun('Photographer A')).toBe(false);
  });

  it('never recognizes any value when the run id is empty', () => {
    const factory = createDataFactory('');

    // An empty run id cannot reliably tag or detect a value.
    expect(factory.belongsToRun('')).toBe(false);
    expect(factory.belongsToRun('anything')).toBe(false);
    expect(factory.belongsToRun('client.qa@example.test')).toBe(false);
  });
});
