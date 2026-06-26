// Property-based + unit tests for CubiCasa order idempotency (`cubicasa.e2e.ts`).
//
// Feature: photographer-onboarding-qa, Property 12: CubiCasa order idempotency.
//
// For ANY number of repeated activations of the CubiCasa create-order control for the same shoot
// (and ANY interleaving of activations across multiple distinct shoots), the system records
// EXACTLY ONE order per shoot beyond the initial (order-less) state: the first activation for a
// shoot creates a pending order with a fresh id; every subsequent activation for that same shoot
// returns the SAME id and creates NO additional order. No duplicate orders are ever produced,
// regardless of how many times — or in what order — the control is activated.
//
// The unit under test is an in-memory model of the per-shoot idempotent create-order operation
// keyed by shoot id, mirroring the backend's "record exactly one order" guarantee (Req 4.3/4.4)
// and the negative-permissions "no duplicate order on repeated activation" check (Req 16.12).
//
// Validates: Requirements 4.3, 4.4, 16.12

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Unit under test — in-memory idempotent create-order model (keyed by shoot id)
// ---------------------------------------------------------------------------

type ShootId = string;
type OrderId = string;

interface CubiCasaOrder {
  id: OrderId;
  shootId: ShootId;
  status: 'pending';
}

/**
 * Result of activating the create-order control once.
 * - `created` is true only on the FIRST activation for a given shoot (a fresh order was recorded).
 * - `created` is false on every subsequent activation (the existing order id is returned).
 */
interface ActivationResult {
  orderId: OrderId;
  created: boolean;
}

/**
 * Models the CubiCasa create-order control as an idempotent operation keyed by shoot id. The
 * first activation for a shoot creates exactly one pending order with a fresh id; subsequent
 * activations for the same shoot are no-ops that return the already-recorded id. This mirrors the
 * backend guarantee that repeated activation records no additional order (Req 4.4, 16.12).
 */
class CubiCasaOrderStore {
  private readonly ordersByShoot = new Map<ShootId, CubiCasaOrder>();
  private seq = 0;

  /** Idempotent create-order for a shoot. Returns the (possibly pre-existing) order id. */
  activateCreateOrder(shootId: ShootId): ActivationResult {
    const existing = this.ordersByShoot.get(shootId);
    if (existing) {
      return { orderId: existing.id, created: false };
    }
    const order: CubiCasaOrder = {
      id: `order-${(this.seq += 1)}`,
      shootId,
      status: 'pending',
    };
    this.ordersByShoot.set(shootId, order);
    return { orderId: order.id, created: true };
  }

  /** All recorded orders (one per shoot at most). */
  allOrders(): CubiCasaOrder[] {
    return [...this.ordersByShoot.values()];
  }

  /** Count of recorded orders for a specific shoot (0 or 1). */
  orderCountFor(shootId: ShootId): number {
    return this.ordersByShoot.has(shootId) ? 1 : 0;
  }
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** A small, fixed pool of shoot ids so interleavings genuinely revisit the same shoots. */
const shootIdArb: fc.Arbitrary<ShootId> = fc
  .integer({ min: 1, max: 6 })
  .map((n) => `shoot-${n}`);

/**
 * A sequence of activations: each element is the shoot id whose create-order control is activated
 * at that step. Arbitrary length and arbitrary interleaving across the shoot pool exercise both
 * "many repeats of one shoot" and "interleaved repeats across many shoots".
 */
const activationSequenceArb: fc.Arbitrary<ShootId[]> = fc.array(shootIdArb, {
  minLength: 1,
  maxLength: 60,
});

// ---------------------------------------------------------------------------
// Property 12: CubiCasa order idempotency
// ---------------------------------------------------------------------------

describe('Feature: photographer-onboarding-qa, Property 12: CubiCasa order idempotency', () => {
  it('records exactly one order per shoot regardless of activation count or interleaving', () => {
    fc.assert(
      fc.property(activationSequenceArb, (activations) => {
        const store = new CubiCasaOrderStore();

        // Track the first-seen order id per shoot to assert id stability across activations.
        const firstOrderIdByShoot = new Map<ShootId, OrderId>();
        let createdCount = 0;

        for (const shootId of activations) {
          const isFirstForShoot = !firstOrderIdByShoot.has(shootId);
          const result = store.activateCreateOrder(shootId);

          if (isFirstForShoot) {
            // First activation for this shoot: a fresh order is created exactly once.
            expect(result.created).toBe(true);
            firstOrderIdByShoot.set(shootId, result.orderId);
            createdCount += 1;
          } else {
            // Subsequent activations: no new order, and the SAME id is returned.
            expect(result.created).toBe(false);
            expect(result.orderId).toBe(firstOrderIdByShoot.get(shootId));
          }

          // At no point does a shoot ever hold more than one order.
          expect(store.orderCountFor(shootId)).toBe(1);
        }

        const distinctShoots = new Set(activations);

        // Exactly one order per distinct shoot — no duplicates beyond the initial state.
        expect(store.allOrders().length).toBe(distinctShoots.size);
        // A creation happened exactly once per distinct shoot (no extra orders recorded).
        expect(createdCount).toBe(distinctShoots.size);

        // Order ids are unique across shoots and each shoot has exactly one.
        const orderIds = store.allOrders().map((o) => o.id);
        expect(new Set(orderIds).size).toBe(orderIds.length);
        for (const shootId of distinctShoots) {
          expect(store.orderCountFor(shootId)).toBe(1);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('keeps per-shoot orders independent: each distinct shoot gets its own single order', () => {
    // Interleave activations across several shoots; every shoot must end with exactly one order
    // and a stable, distinct id.
    fc.assert(
      fc.property(
        fc.array(shootIdArb, { minLength: 1, maxLength: 60 }),
        (activations) => {
          const store = new CubiCasaOrderStore();
          const idByShoot = new Map<ShootId, OrderId>();

          for (const shootId of activations) {
            const { orderId } = store.activateCreateOrder(shootId);
            const known = idByShoot.get(shootId);
            if (known === undefined) {
              idByShoot.set(shootId, orderId);
            } else {
              // The id for a given shoot never changes across activations.
              expect(orderId).toBe(known);
            }
          }

          // Every order belongs to a distinct shoot, and each shoot maps to its own order id.
          const orders = store.allOrders();
          expect(orders.length).toBe(idByShoot.size);
          const shootIds = orders.map((o) => o.shootId);
          expect(new Set(shootIds).size).toBe(shootIds.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('records exactly one pending order after repeated activation of a single shoot', () => {
    const store = new CubiCasaOrderStore();

    const first = store.activateCreateOrder('shoot-1');
    expect(first.created).toBe(true);
    expect(first.orderId).toBe('order-1');

    // Repeated activations (e.g. a double-click) record no additional order.
    for (let i = 0; i < 10; i += 1) {
      const again = store.activateCreateOrder('shoot-1');
      expect(again.created).toBe(false);
      expect(again.orderId).toBe('order-1');
    }

    expect(store.orderCountFor('shoot-1')).toBe(1);
    expect(store.allOrders().length).toBe(1);
    expect(store.allOrders()[0].status).toBe('pending');
  });

  it('records one order per shoot across two shoots, never cross-contaminating ids', () => {
    const store = new CubiCasaOrderStore();

    const a1 = store.activateCreateOrder('shoot-A');
    const b1 = store.activateCreateOrder('shoot-B');
    const a2 = store.activateCreateOrder('shoot-A');
    const b2 = store.activateCreateOrder('shoot-B');

    expect(a1.created).toBe(true);
    expect(b1.created).toBe(true);
    expect(a2.created).toBe(false);
    expect(b2.created).toBe(false);

    expect(a1.orderId).toBe(a2.orderId);
    expect(b1.orderId).toBe(b2.orderId);
    expect(a1.orderId).not.toBe(b1.orderId);

    expect(store.allOrders().length).toBe(2);
  });
});
