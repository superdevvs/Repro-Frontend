/** Only standalone, unauthenticated tour/share routes use the small entry. */
export function isPublicTourEntry(pathname: string): boolean {
  return /^\/tours?\//i.test(pathname)
    || /^\/share\/[^/]+\/?$/i.test(pathname)
    || /^\/download\/media\/?$/i.test(pathname);
}
