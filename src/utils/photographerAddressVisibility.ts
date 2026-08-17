export type PhotographerAddressVisibility = 'full' | 'region' | 'hidden';

type ViewerRole = string | null | undefined;

type AddressSubject = {
  role?: string | null;
  address_visibility?: PhotographerAddressVisibility | null;
  id?: string | number | null;
};

export function photographerAddressVisibility(
  subject: AddressSubject | null | undefined,
  viewerRole: ViewerRole,
  viewerId?: string | number | null,
): PhotographerAddressVisibility {
  if (subject?.address_visibility) {
    return subject.address_visibility;
  }

  if (String(subject?.role ?? '') !== 'photographer') {
    return 'full';
  }

  if (viewerId != null && subject?.id != null && String(viewerId) === String(subject.id)) {
    return 'full';
  }

  const role = String(viewerRole ?? '');
  if (role === 'admin' || role === 'superadmin') {
    return 'full';
  }
  if (role === 'salesRep' || role === 'editing_manager') {
    return 'region';
  }

  return 'hidden';
}

export function canViewPhotographerStreet(
  subject: AddressSubject | null | undefined,
  viewerRole: ViewerRole,
  viewerId?: string | number | null,
): boolean {
  return photographerAddressVisibility(subject, viewerRole, viewerId) === 'full';
}

export function canViewPhotographerRegion(
  subject: AddressSubject | null | undefined,
  viewerRole: ViewerRole,
  viewerId?: string | number | null,
): boolean {
  return photographerAddressVisibility(subject, viewerRole, viewerId) !== 'hidden';
}
