import type { AccountFormValues } from './accountFormModel';

/**
 * Photographer-only payload/metadata mapping for the admin account form.
 *
 * Extracted verbatim from `useAccountFormController` to keep that module under
 * the repository file-size limit. Field names, guards and ordering are
 * unchanged; callers still apply this only for the photographer role.
 */
export function applyPhotographerAccountPayload(
  values: AccountFormValues,
  metadataPayload: Record<string, unknown>,
  payload: { default_bracket_mode?: 3 | 5 },
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
  if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
    metadataPayload.specialties = values.specialties;
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
