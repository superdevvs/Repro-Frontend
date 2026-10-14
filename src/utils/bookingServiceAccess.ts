/** Client service groups constrain self-service; these staff roles can book the full catalog. */
export const canBookOutsideClientServiceGroups = (role?: string | null): boolean =>
  ['admin', 'superadmin', 'salesrep', 'rep', 'representative'].includes(String(role ?? '').toLowerCase().replace(/[_\s-]/g, ''));

/** Creation follows StoreShootRequest; edits retain the server's separate removal capability. */
export const canBookWithoutServices = (input: {
  role?: string | null;
  isImpersonating?: boolean;
  isEditMode?: boolean;
  canRemoveAllServicesForEdit?: boolean;
  shootType?: string | null;
}): boolean => {
  if (input.isEditMode) return input.canRemoveAllServicesForEdit === true;

  return !input.isImpersonating && String(input.role ?? '').toLowerCase() === 'superadmin' &&
    ['complimentary', 'sample_upload', 'internal_test', 'pricing_pending'].includes(input.shootType ?? 'standard');
};
