export const PHOTOGRAPHER_PROPERTY_TYPES = [
  'Single Family', 'Multi-Family', 'Condo/Townhouse', 'Apartment',
  'Vacant Land', 'Office', 'Retail', 'Industrial',
] as const;

export const canManagePhotographerCapabilities = (effectiveRole?: string, isImpersonating = false): boolean => (
  !isImpersonating && ['admin', 'superadmin'].includes(effectiveRole || '')
);
