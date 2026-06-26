// Property-based + unit tests for the run-scoped entity tracker (`entity-tracker.ts`) together
// with the run-id data factory (`data-factory.ts`).
//
// Feature: photographer-onboarding-qa, Property 2: Run-id run-scoped cleanup selects exactly
// the run's entities across all types.
//
// For any set of tracked entities spanning every QA_Entity type (account, shoot, booking,
// rawFile, editedFile, cubicasaOrder, cubicasaReference, equipment, equipmentAssignment,
// invoice, reminderRecord, notificationLog, client, address, availabilityWindow, blockedWindow,
// report) — some created during the current run and some not — cleanup selection
// (`belongingToRun`) returns EXACTLY the entities whose identifier carries the current run-id
// suffix: no false positives and no false negatives.
//
// Validates: Requirements 21.1, 21.3, 21.4, 23.2

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createDataFactory } from './data-factory';
import { createEntityTracker, type EntityType, type TrackedEntity } from './entity-tracker';

/**
 * The full QA_Entity type space (Requirement 21.1). The property must hold across ALL of
 * these, so generators draw the type from this exact set.
 */
const ALL_ENTITY_TYPES: readonly EntityType[] = [
  'account',
  'shoot',
  'booking',
  'rawFile',
  'editedFile',
  'cubicasaOrder',
  'cubicasaReference',
  'equipment',
  'equipmentAssignment',
  'invoice',
  'reminderRecord',
  'notificationLog',
  'client',
  'address',
  'availabilityWindow',
  'blockedWindow',
  'report',
];

// Sanity guard: the suite asserts behavior across all 17 QA_Entity types.
expect(ALL_ENTITY_TYPES.length).toBe(17);

/** The three suffix-bearing label shapes the data factory produces. */
type LabelForm = 'name' | 'email' | 'address';

/**
 * How an entity's label is constructed:
 * - `run`   → suffixed with the CURRENT run id via the data factory → belongs to the run.
 * - `other` → suffixed with a DIFFERENT run id → does NOT belong to the run.
 * - `plain` → no run-id suffix at all → does NOT belong to the run.
 */
type LabelKind = 'run' | 'other' | 'plain';

interface EntitySpec {
  typeIndex: number;
  kind: LabelKind;
  form: LabelForm;
  base: string;
}

/**
 * Fixed-length, digit-only run ids. Equal length + digit-only guarantees that one run id can
 * never be a proper suffix of another, so a different run id's suffix can never be mistaken for
 * the current run's suffix. (Names/addresses use a leading-space token; emails use a
 * leading-dot token in the local part — in both cases a 6-digit token only matches an identical
 * 6-digit token.)
 */
const runIdArb = fc.integer({ min: 0, max: 999_999 }).map((n) => String(n).padStart(6, '0'));

/**
 * Bases never contain a space or an `@`, and are not pure 6-digit strings, so a `plain` (no
 * suffix) label can never accidentally end with a run-id suffix token.
 */
const baseArb = fc.constantFrom(
  'account',
  'shoot',
  'booking',
  'raw-file',
  'edited-file',
  'cubicasa-order',
  'equipment',
  'invoice',
  'reminder',
  'notification',
  'client.qa',
  'admin.qa',
  'photographer.qa',
  'base-location',
  'availability',
  'blocked',
  'report',
);

const entitySpecArb: fc.Arbitrary<EntitySpec> = fc.record({
  typeIndex: fc.integer({ min: 0, max: ALL_ENTITY_TYPES.length - 1 }),
  kind: fc.constantFrom<LabelKind>('run', 'other', 'plain'),
  form: fc.constantFrom<LabelForm>('name', 'email', 'address'),
  base: baseArb,
});

/** Build the label for a spec, using the run factory or a different-run factory as appropriate. */
function buildLabel(
  spec: EntitySpec,
  runFactory: ReturnType<typeof createDataFactory>,
  otherFactory: ReturnType<typeof createDataFactory>,
): string {
  if (spec.kind === 'plain') {
    return spec.base;
  }
  const factory = spec.kind === 'run' ? runFactory : otherFactory;
  return factory[spec.form](spec.base);
}

/** A stable comparison key for an entity ((type, id) is unique per generated entity). */
const keyOf = (e: TrackedEntity): string => `${e.type}:${String(e.id)}`;

describe('Feature: photographer-onboarding-qa, Property 2: Run-id run-scoped cleanup selects exactly the run\'s entities across all types', () => {
  it('selects exactly the run-tagged entities across a mixed set spanning every QA_Entity type (no false positives/negatives)', () => {
    fc.assert(
      fc.property(
        runIdArb,
        // Offset guarantees a DIFFERENT run id without discarding generated values.
        fc.integer({ min: 1, max: 999_999 }),
        fc.array(entitySpecArb, { minLength: 1, maxLength: 80 }),
        (runId, offset, specs) => {
          const otherRunId = String((Number(runId) + offset) % 1_000_000).padStart(6, '0');
          // The offset range (1..999_999) guarantees inequality modulo 1_000_000.
          expect(otherRunId).not.toBe(runId);

          const factory = createDataFactory(runId);
          const otherFactory = createDataFactory(otherRunId);
          const tracker = createEntityTracker(runId);

          // Track every generated entity with a UNIQUE id (the index) so (type, id) keys never
          // collide and dedup never collapses distinct entities.
          const expectedKeys = new Set<string>();
          specs.forEach((spec, index) => {
            const type = ALL_ENTITY_TYPES[spec.typeIndex];
            const label = buildLabel(spec, factory, otherFactory);
            tracker.track(type, index, label);
            if (spec.kind === 'run') {
              expectedKeys.add(`${type}:${String(index)}`);
            }
          });

          const selected = tracker.belongingToRun(factory);
          const selectedKeys = new Set(selected.map(keyOf));

          // Exact match: same size, and every selected key is expected (⇒ also the reverse).
          expect(selectedKeys.size).toBe(selected.length); // no duplicates in the selection
          expect(selectedKeys.size).toBe(expectedKeys.size);
          for (const key of selectedKeys) {
            expect(expectedKeys.has(key)).toBe(true); // no false positives
          }
          for (const key of expectedKeys) {
            expect(selectedKeys.has(key)).toBe(true); // no false negatives
          }

          // Every selected entity's label genuinely carries the current run suffix.
          for (const entity of selected) {
            expect(entity.label !== undefined && factory.belongsToRun(entity.label)).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('selects exactly the run-tagged entity for EACH of the 17 QA_Entity types (one tagged + one untagged per type)', () => {
    const runId = '424242';
    const otherRunId = '999999';
    const factory = createDataFactory(runId);
    const otherFactory = createDataFactory(otherRunId);
    const tracker = createEntityTracker(runId);

    const expectedKeys = new Set<string>();

    ALL_ENTITY_TYPES.forEach((type, i) => {
      // Tagged with the current run → must be selected.
      const taggedId = `${type}-run-${i}`;
      tracker.track(type, taggedId, factory.name(`${type}-entity`));
      expectedKeys.add(`${type}:${taggedId}`);

      // Tagged with a different run → must NOT be selected.
      const otherId = `${type}-other-${i}`;
      tracker.track(type, otherId, otherFactory.email(`${type}-entity`));

      // No suffix at all → must NOT be selected.
      const plainId = `${type}-plain-${i}`;
      tracker.track(type, plainId, `${type}-entity`);
    });

    const selected = tracker.belongingToRun(factory);
    const selectedKeys = new Set(selected.map(keyOf));

    expect(selectedKeys.size).toBe(ALL_ENTITY_TYPES.length);
    expect(selectedKeys).toEqual(expectedKeys);
  });

  it('selects nothing when no tracked entity carries the current run suffix', () => {
    const factory = createDataFactory('100001');
    const otherFactory = createDataFactory('200002');
    const tracker = createEntityTracker('100001');

    tracker.track('account', 1, otherFactory.email('admin.qa'));
    tracker.track('shoot', 2, 'shoot-without-suffix');
    tracker.track('invoice', 3, otherFactory.name('invoice'));

    expect(tracker.belongingToRun(factory)).toEqual([]);
  });
});
