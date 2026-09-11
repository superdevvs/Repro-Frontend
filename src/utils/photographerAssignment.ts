// Photographer-assignment grouping for the booking Scheduling step.
//
// The scheduling UI assigns a photographer (and schedule) PER SELECTED SERVICE.
// Assignment is intentionally NOT grouped by service category and is NOT
// role-dependent: a Sales Rep and a Super Admin see the exact same model.
//
// Rationale (product fix): grouping by category collapsed two same-category
// services (e.g. two "Photos" services) into a single photographer assignment.
// Each selected service line must remain independently assignable. Category is
// retained only as a display label, never as the grouping key — so services
// with a missing/duplicate category never collapse unrelated selections.

export interface AssignableServiceCategory {
  id?: string | number;
  name?: string | null;
}

export interface AssignableService {
  id: string;
  name: string;
  category?: AssignableServiceCategory | null;
  photographer_required?: boolean | null;
}

export function serviceRequiresPhotographer(
  service?: Pick<AssignableService, 'photographer_required'> | null,
): boolean {
  // Explicit false is the only opt-out. Missing values keep the historical
  // photographer workflow so cached drafts and older payloads stay safe.
  return service?.photographer_required !== false;
}

export function photographerRequiredServices<T extends Pick<AssignableService, 'photographer_required'>>(
  selectedServices: ReadonlyArray<T> | null | undefined,
): T[] {
  return (selectedServices ?? []).filter((service) => serviceRequiresPhotographer(service));
}

export function selectedServicesRequirePhotographer(
  selectedServices: ReadonlyArray<Pick<AssignableService, 'photographer_required'>> | null | undefined,
): boolean {
  return photographerRequiredServices(selectedServices).length > 0;
}

export interface AssignmentGroup {
  /** Stable React key + identity = the service id (never the category). */
  key: string;
  serviceId: string;
  serviceName: string;
  /** Display-only label; defaults to 'Other' when the service has no category. */
  categoryName: string;
}

/**
 * One assignment group per selected service, in selection order.
 * Each group is keyed by the service id so same-category (or category-less)
 * services never merge into one another.
 */
export function buildAssignmentGroups(
  selectedServices: ReadonlyArray<AssignableService>,
): AssignmentGroup[] {
  return photographerRequiredServices(selectedServices).map((service) => ({
    key: service.id,
    serviceId: service.id,
    serviceName: service.name,
    categoryName: service.category?.name ?? 'Other',
  }));
}

/**
 * Whether the UI should render a separate photographer assignment per service.
 * True whenever more than one photographer-required service is selected.
 */
export function requiresPerServiceAssignment(
  selectedServices: ReadonlyArray<AssignableService>,
): boolean {
  return photographerRequiredServices(selectedServices).length > 1;
}
