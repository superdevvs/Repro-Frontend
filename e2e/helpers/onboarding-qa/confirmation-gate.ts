import type { QaEnv } from './env';

/**
 * The single choke point for every `Destructive_Step` and `Charge_Triggering_Step`
 * (Requirements 2.2, 2.4, 18.11, 21.2).
 *
 * The gate is non-interactive in CI: confirmation is supplied per-category through the
 * environment allow-flags resolved by {@link QaEnv} (`E2E_CONFIRM_DESTRUCTIVE`,
 * `E2E_CONFIRM_CHARGE`, `E2E_CONFIRM_MESSAGE`) with an optional fine-grained
 * `E2E_CONFIRM_CATEGORIES` list. Every flag defaults to **declined**, so the suite is
 * read-only by default (Requirement 2.1). Where a step exposes a non-charging path, the
 * gate executor prefers it (Requirements 2.5, 18.12).
 */

/** The category of a guarded step, mapped to a per-category confirmation allow-flag. */
export type StepKind = 'destructive' | 'charge' | 'message';

/**
 * A unit of work routed through the {@link ConfirmationGate}. A guarded step only performs
 * its real `action` when confirmed and no safe path exists; when a `nonChargingPath` is
 * supplied it is always preferred and runs without confirmation.
 */
export interface GuardedStep<T> {
  /** Human-readable step name, surfaced in the report when the step is skipped. */
  name: string;
  /** The category of the step, used to select the confirmation allow-flag. */
  kind: StepKind;
  /** Optional fine-grained category matched against `E2E_CONFIRM_CATEGORIES`. */
  category?: string;
  /**
   * Preferred non-charging path. When present it is chosen automatically and executed
   * without requiring confirmation (Requirements 2.5, 18.12).
   */
  nonChargingPath?: () => Promise<T>;
  /**
   * The real (charging/destructive/message-triggering) action. Only run when the gate is
   * confirmed for the step's kind/category and no `nonChargingPath` is provided.
   */
  action: () => Promise<T>;
}

/** The outcome of routing a {@link GuardedStep} through the gate. */
export interface GateResult<T> {
  /**
   * `executed` when an action (or the non-charging path) ran, `skipped` when confirmation
   * was declined, `blocked` when the step could not be evaluated.
   */
  status: 'executed' | 'skipped' | 'blocked';
  /** The value produced by the executed path, when `status` is `executed`. */
  value?: T;
  /** A short explanation, primarily for `skipped`/`blocked` outcomes. */
  reason?: string;
}

/**
 * The confirmation gate contract. `isConfirmed` reports whether a given step kind/category
 * is allowed by the resolved environment flags; `run` enforces the gating semantics.
 */
export interface ConfirmationGate {
  /** True iff the supplied kind (optionally narrowed by category) is confirmed. */
  isConfirmed(kind: StepKind, category?: string): boolean;
  /** Route a guarded step through the gate, returning its {@link GateResult}. */
  run<T>(step: GuardedStep<T>): Promise<GateResult<T>>;
}

/** Map a {@link StepKind} to its corresponding per-category env allow-flag. */
function kindAllowed(env: QaEnv, kind: StepKind): boolean {
  switch (kind) {
    case 'destructive':
      return env.confirmDestructive;
    case 'charge':
      return env.confirmCharge;
    case 'message':
      return env.confirmMessage;
    default:
      return false;
  }
}

/**
 * Create the confirmation gate from the resolved {@link QaEnv}. The gate holds no mutable
 * state; it reads the allow-flags supplied at construction time.
 */
export function createConfirmationGate(env: QaEnv): ConfirmationGate {
  function isConfirmed(kind: StepKind, category?: string): boolean {
    // A fine-grained category opt-in (E2E_CONFIRM_CATEGORIES) confirms the step on its own.
    if (category && env.confirmCategories?.includes(category)) {
      return true;
    }
    return kindAllowed(env, kind);
  }

  async function run<T>(step: GuardedStep<T>): Promise<GateResult<T>> {
    // 1. Prefer the non-charging path when present — no confirmation needed (Req 2.5/18.12).
    if (step.nonChargingPath) {
      const value = await step.nonChargingPath();
      return { status: 'executed', value, reason: 'non-charging-path' };
    }

    // 2. Otherwise the real action runs only when confirmed for this kind/category.
    if (isConfirmed(step.kind, step.category)) {
      const value = await step.action();
      return { status: 'executed', value };
    }

    // 3. Declined by default → skip and let the report record the skip (Req 2.1/2.3).
    return {
      status: 'skipped',
      reason: `Confirmation declined for ${step.kind} step "${step.name}"${
        step.category ? ` (category: ${step.category})` : ''
      }`,
    };
  }

  return { isConfirmed, run };
}
