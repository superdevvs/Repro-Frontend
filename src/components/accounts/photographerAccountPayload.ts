import type { AccountFormValues } from './accountFormModel';

/**
 * Photographer-only payload/metadata mapping for the admin account form.
 *
 * Admins can assign or clear capabilities. Other account editors omit those
 * fields so unrelated edits preserve the server's managed assignments.
 * Callers apply this mapping only for the photographer role.
 */
export function applyPhotographerAccountPayload(
  values: AccountFormValues,
  metadataPayload: Record<string, unknown>,
  payload: { default_bracket_mode?: 3 | 5; specialties?: string[]; propertyTypes?: string[] },
  canManageCapabilities: boolean,
): void {
  if (values.pilotLicenseFile) {
    metadataPayload.pilotLicenseFile = values.pilotLicenseFile;
  }
  if (values.pilotLicenseFileName) {
    metadataPayload.pilotLicenseFileName = values.pilotLicenseFileName;
  }
  if (values.insuranceNumber) {
    metadataPayload.insuranceNumber = values.insuranceNumber;
  }
  if (values.insuranceFile) {
    metadataPayload.insuranceFile = values.insuranceFile;
  }
  if (values.insuranceFileName) {
    metadataPayload.insuranceFileName = values.insuranceFileName;
  }
  if (canManageCapabilities) {
    metadataPayload.specialties = values.specialties ?? [];
    metadataPayload.property_types = values.propertyTypes ?? [];
  } else {
    delete metadataPayload.specialties;
    delete metadataPayload.property_types;
    delete payload.specialties;
    delete payload.propertyTypes;
  }
  if (values.travelRange !== undefined) {
    metadataPayload.travel_range = values.travelRange;
  }
  if (values.travelRangeUnit) {
    metadataPayload.travel_range_unit = values.travelRangeUnit;
  }
  // A top-level column, not metadata, because BracketModeResolver reads it
  // directly when seeding a new bracket-capable assignment.
  if (values.defaultBracketMode) {
    payload.default_bracket_mode = values.defaultBracketMode;
  }
}
