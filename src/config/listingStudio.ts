export const LISTING_STUDIO_WEBSITE_URL = 'https://reprophotos.com/listing-studio';
export const LISTING_STUDIO_CLIENT_PATH = '/listing-studio';
export const FREE_EDITS_PATH = '/listing-studio/free-edits';

// Verification redirects support this one campaign destination only.
export const listingStudioVerificationReturn = (path?: string) => path === FREE_EDITS_PATH ? FREE_EDITS_PATH : undefined;
