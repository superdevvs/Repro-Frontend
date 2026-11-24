export const LISTING_STUDIO_WEBSITE_URL = 'https://reprophotos.com/listing-studio';
export const LISTING_STUDIO_CLIENT_PATH = '/listing-studio';
export const LISTING_STUDIO_EDITOR_SECTION = 'listing-studio';
export const FREE_EDITS_PATH = '/listing-studio/free-edits';

export function listingStudioManageHref({
  clientId, search = '', hash = '', embedded = false,
}: {
  clientId?: string;
  search?: string;
  hash?: string;
  embedded?: boolean;
} = {}): string {
  const params = new URLSearchParams(search);
  const path = embedded ? '/ai-editing' : '/listing-studio/manage' + (clientId ? '/' + encodeURIComponent(clientId) : '');
  if (embedded) {
    params.set('section', LISTING_STUDIO_EDITOR_SECTION);
    if (clientId) params.set('clientId', clientId);
    else params.delete('clientId');
  }
  const query = params.toString();
  return path + (query ? '?' + query : '') + hash;
}

// Verification redirects support this one campaign destination only.
export const listingStudioVerificationReturn = (path?: string) => path === FREE_EDITS_PATH ? FREE_EDITS_PATH : undefined;
