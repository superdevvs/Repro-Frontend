import type { DataFactory } from './data-factory';

/**
 * The complete set of `QA_Entity` kinds the suite can create during a run.
 *
 * Cleanup is run-scoped across ALL of these types (not just accounts), so every create
 * path in the harness registers the entity it produced with the tracker. The literal
 * union mirrors the `QA_Entity` glossary entry in `requirements.md` (Requirement 21.1):
 * accounts, shoots, bookings, raw/edited files, CubiCasa orders/references, equipment +
 * assignments, invoices, payment-reminder records, notification logs, clients, addresses,
 * availability/blocked windows, and generated reports.
 */
export type EntityType =
  | 'account'
  | 'shoot'
  | 'booking'
  | 'rawFile'
  | 'editedFile'
  | 'cubicasaOrder'
  | 'cubicasaReference'
  | 'equipment'
  | 'equipmentAssignment'
  | 'invoice'
  | 'reminderRecord'
  | 'notificationLog'
  | 'client'
  | 'address'
  | 'availabilityWindow'
  | 'blockedWindow'
  | 'report';

/** A single entity created during the run, identified by type + id and an optional label. */
export interface TrackedEntity {
  type: EntityType;
  id: string | number;
  /** Human-readable identifier (name/email/address) carrying the run-id suffix where applicable. */
  label?: string;
}

/**
 * Run-scoped registry of every `QA_Entity` created during a run.
 *
 * Create paths call {@link EntityTracker.track}; the cleanup spec iterates the tracker and
 * removes exactly the entities that belong to the current run via
 * {@link EntityTracker.belongingToRun} (Requirement 21.1).
 */
export interface EntityTracker {
  /** Register a created entity. Idempotent per (type, id) so repeated registration is safe. */
  track(type: EntityType, id: string | number, label?: string): void;
  /** Every entity registered during the run, in registration order. */
  all(): TrackedEntity[];
  /** Entities whose label or id carries the current run-id suffix (Requirement 21.1). */
  belongingToRun(factory: DataFactory): TrackedEntity[];
}

/**
 * Create a run-scoped {@link EntityTracker}.
 *
 * The `runId` identifies the run the tracker belongs to; run membership is decided by the
 * {@link DataFactory.belongsToRun} predicate passed to {@link EntityTracker.belongingToRun},
 * keeping suffixing rules in one place (the data factory).
 */
export function createEntityTracker(runId: string): EntityTracker {
  const entities: TrackedEntity[] = [];
  const seen = new Set<string>();

  const keyOf = (type: EntityType, id: string | number): string => `${type}:${String(id)}`;

  return {
    track(type: EntityType, id: string | number, label?: string): void {
      const key = keyOf(type, id);
      // A create path may register the same entity more than once (e.g. retry); keep it unique
      // so cleanup does not attempt to remove the same record twice.
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      entities.push(label === undefined ? { type, id } : { type, id, label });
    },

    all(): TrackedEntity[] {
      return entities.slice();
    },

    belongingToRun(factory: DataFactory): TrackedEntity[] {
      return entities.filter(
        (entity) =>
          (entity.label !== undefined && factory.belongsToRun(entity.label)) ||
          factory.belongsToRun(String(entity.id)),
      );
    },
  };
}
