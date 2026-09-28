import { LISTING_STUDIO_WEBSITE_URL } from '@/config/listingStudio';

export const LISTING_STUDIO_QUERY = 'listingStudio';

export const listingStudioRole = (role?: string, secondaryRoles?: string[]): string | undefined => {
  const roles = [role, ...(secondaryRoles ?? [])].map(item => {
    const normalized = (item ?? '').toLowerCase().replace(/[_-]/g, '');
    return normalized === 'rep' ? 'salesrep' : normalized;
  });
  return ['superadmin', 'admin', 'salesrep', 'client'].find(item => roles.includes(item));
};

export const canUseListingStudio = (role?: string, secondaryRoles?: string[]): boolean =>
  Boolean(listingStudioRole(role, secondaryRoles));

export const canUseListingStudioDashboard = (role?: string, secondaryRoles?: string[]): boolean =>
  ['salesrep', 'admin', 'superadmin'].includes(listingStudioRole(role, secondaryRoles) ?? '');

export const canReviewListingStudio = (role?: string, secondaryRoles?: string[]): boolean =>
  ['admin', 'superadmin'].includes(listingStudioRole(role, secondaryRoles) ?? '');

export const listingStudioHref = (location: { pathname: string; search: string; hash: string }, role?: string, secondaryRoles?: string[]): string => {
  if (listingStudioRole(role, secondaryRoles) === 'client') return LISTING_STUDIO_WEBSITE_URL;
  const params = new URLSearchParams(location.search);
  params.set(LISTING_STUDIO_QUERY, '1');
  return `${location.pathname}?${params.toString()}${location.hash}`;
};
