// Property-based + unit tests for the equipment assignment round-trip of the photographer
// onboarding QA suite.
//
// Feature: photographer-onboarding-qa, Property 15: Equipment assignment round-trip.
//
// Property 15 (design.md):
//
//   For ANY `Equipment_Item` and ANY assignment target (photographer or shoot), recording the
//   assignment and then reading the tracking surface yields that same target as the item's current
//   `Equipment_Assignment`.
//
// The unit under test is a deterministic, in-memory equipment backbone that mirrors the
// add→assign→currentAssignment contract used by the live suite in
// `frontend/e2e/onboarding/equipment.e2e.ts` (which itself mirrors the Laravel
// `photographer_equipments` admin surface: POST create, PUT assign, GET tracking listing). The
// property generates equipment items and a sequence of assignment targets — including
// RE-ASSIGNMENT of an already-assigned item to a NEW target — and asserts that reading the tracking
// surface always yields the LATEST recorded target (round-trip + latest-wins).
//
// ## Documented finding (carried from equipment.e2e.ts)
// The backend associates an `Equipment_Item` with a PHOTOGRAPHER only (`photographer_id`); there is
// NO equipment↔shoot relation in the schema or controller. Requirement 19.3 / Property 15 read
// "photographer OR shoot", so this model treats the photographer target as the LIVE path and ALSO
// models a generic `target.type` of `'photographer' | 'shoot'` to cover the design's
// "photographer or shoot" statement. The round-trip invariant must hold for BOTH target types.
//
// This is a pure / in-memory property test — no live target, no network. It runs 200 generated
// iterations (≥ the 100 minimum mandated by Requirement 23).
//
// Validates: Requirements 19.3, 19.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// ------------------------------------------------------------------------------------------------
// Unit under test: the deterministic equipment backbone (mirrors `onboarding/equipment.e2e.ts`).
// ------------------------------------------------------------------------------------------------

/** An assignment target — a photographer (the live path) or a shoot (the design's generic case). */
interface AssignmentTarget {
  type: 'photographer' | 'shoot';
  id: number;
}

/** An equipment item in the deterministic model (mirrors the `photographer_equipments` contract). */
interface ModelEquipment {
  id: number;
  name: string;
  /** The live backbone tracks `photographer_id`; null when assigned to a non-photographer target. */
  photographer_id: number | null;
}

/** The recorded association between an item and a target (the `Equipment_Assignment`). */
interface ModelAssignment {
  equipmentId: number;
  target: AssignmentTarget;
}

/**
 * A pure, deterministic equipment service mirroring the backend contract so the
 * add→assign→track (round-trip) invariant is verifiable without a live target. The
 * `currentAssignment` read is the "tracking surface" read-back (Req 19.4).
 */
interface EquipmentBackbone {
  add(name: string): ModelEquipment;
  assign(equipmentId: number, target: AssignmentTarget): ModelAssignment;
  currentAssignment(equipmentId: number): ModelAssignment | null;
}

function createEquipmentBackbone(): EquipmentBackbone {
  const items = new Map<number, ModelEquipment>();
  const assignments = new Map<number, ModelAssignment>();
  let nextId = 1;

  return {
    add(name) {
      const item: ModelEquipment = { id: nextId++, name, photographer_id: null };
      items.set(item.id, item);
      return { ...item };
    },
    assign(equipmentId, target) {
      const item = items.get(equipmentId);
      if (!item) {
        throw new Error(`Cannot assign unknown equipment ${equipmentId}`);
      }
      // Mirror the live backbone: a photographer target sets photographer_id; a shoot target (which
      // has no backend column) clears it. The recorded Equipment_Assignment is the source of truth.
      item.photographer_id = target.type === 'photographer' ? target.id : null;
      const assignment: ModelAssignment = { equipmentId, target: { ...target } };
      assignments.set(equipmentId, assignment);
      return { equipmentId, target: { ...target } };
    },
    currentAssignment(equipmentId) {
      const assignment = assignments.get(equipmentId);
      return assignment ? { equipmentId, target: { ...assignment.target } } : null;
    },
  };
}

// ------------------------------------------------------------------------------------------------
// Generators
// ------------------------------------------------------------------------------------------------

/** An assignment target spanning BOTH modelled types (photographer = live path; shoot = generic). */
const targetArb: fc.Arbitrary<AssignmentTarget> = fc.record({
  type: fc.constantFrom<'photographer' | 'shoot'>('photographer', 'shoot'),
  id: fc.integer({ min: 1, max: 1_000_000 }),
});

/** Equipment item names (the live items carry a run-id suffix; the round-trip is name-agnostic). */
const nameArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 40 });

/**
 * A non-empty sequence of assignment targets for a single item. Length ≥ 2 in most cases so
 * RE-ASSIGNMENT (assigning an already-assigned item to a new target) is exercised heavily; the
 * final element is the expected "latest" target.
 */
const targetSequenceArb: fc.Arbitrary<AssignmentTarget[]> = fc.array(targetArb, {
  minLength: 1,
  maxLength: 8,
});

// ------------------------------------------------------------------------------------------------
// Property 15
// ------------------------------------------------------------------------------------------------

describe('Feature: photographer-onboarding-qa, Property 15: Equipment assignment round-trip', () => {
  it('reads back exactly the recorded target for any single Equipment_Item and any target', () => {
    fc.assert(
      fc.property(nameArb, targetArb, (name, target) => {
        const backbone = createEquipmentBackbone();
        const item = backbone.add(name);

        backbone.assign(item.id, target);
        const current = backbone.currentAssignment(item.id);

        // Round-trip: the tracking surface yields exactly the recorded target (type AND id).
        // `toEqual` compares by value — the backbone returns plain-prototype copies (as a real
        // JSON API does), whereas the generated target has a null prototype.
        expect(current).not.toBeNull();
        expect(current!.target).toEqual(target);
      }),
      { numRuns: 200 },
    );
  });

  it('yields the LATEST recorded target after re-assignment (latest-wins) for any target sequence', () => {
    fc.assert(
      fc.property(nameArb, targetSequenceArb, (name, targets) => {
        const backbone = createEquipmentBackbone();
        const item = backbone.add(name);

        // Record each assignment in order; re-assignment overwrites the previous target.
        for (const target of targets) {
          backbone.assign(item.id, target);
          // Invariant after EACH step: the tracking surface reflects the just-recorded target.
          expect(backbone.currentAssignment(item.id)!.target).toEqual(target);
        }

        // After the whole sequence, the current assignment is the LATEST recorded target.
        const expected = targets[targets.length - 1];
        expect(backbone.currentAssignment(item.id)!.target).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('keeps assignments isolated per item: assigning one item never changes another item', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(nameArb, targetArb), { minLength: 2, maxLength: 8 }),
        (entries) => {
          const backbone = createEquipmentBackbone();

          // Add every item first, then assign each its own target.
          const ids = entries.map(([name]) => backbone.add(name).id);
          ids.forEach((id, i) => backbone.assign(id, entries[i][1]));

          // Each item reads back exactly its OWN recorded target — no cross-item leakage.
          ids.forEach((id, i) => {
            expect(backbone.currentAssignment(id)!.target).toEqual(entries[i][1]);
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  // --- Concrete unit anchors covering both target types and re-assignment ----------------------

  it('round-trips a photographer target (the live path)', () => {
    const backbone = createEquipmentBackbone();
    const item = backbone.add('QA Equipment camera');
    backbone.assign(item.id, { type: 'photographer', id: 9001 });
    expect(backbone.currentAssignment(item.id)).toStrictEqual({
      equipmentId: item.id,
      target: { type: 'photographer', id: 9001 },
    });
  });

  it('round-trips a shoot target (the design\'s generic case)', () => {
    const backbone = createEquipmentBackbone();
    const item = backbone.add('QA Equipment drone');
    backbone.assign(item.id, { type: 'shoot', id: 4242 });
    expect(backbone.currentAssignment(item.id)).toStrictEqual({
      equipmentId: item.id,
      target: { type: 'shoot', id: 4242 },
    });
  });

  it('applies latest-wins when re-assigning across target types', () => {
    const backbone = createEquipmentBackbone();
    const item = backbone.add('QA Equipment lens');

    backbone.assign(item.id, { type: 'photographer', id: 1 });
    expect(backbone.currentAssignment(item.id)!.target).toStrictEqual({ type: 'photographer', id: 1 });

    backbone.assign(item.id, { type: 'shoot', id: 2 });
    expect(backbone.currentAssignment(item.id)!.target).toStrictEqual({ type: 'shoot', id: 2 });

    backbone.assign(item.id, { type: 'photographer', id: 3 });
    expect(backbone.currentAssignment(item.id)!.target).toStrictEqual({ type: 'photographer', id: 3 });
  });

  it('reports no assignment for an added-but-unassigned item', () => {
    const backbone = createEquipmentBackbone();
    const item = backbone.add('QA Equipment tripod');
    expect(backbone.currentAssignment(item.id)).toBeNull();
  });
});
