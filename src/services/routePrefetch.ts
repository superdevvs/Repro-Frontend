const routes: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/shoot-history': () => import('@/pages/ShootHistory'),
  '/accounting': () => import('@/pages/Accounting'),
  '/accounts': () => import('@/pages/Accounts'),
  '/availability': () => import('@/pages/Availability'),
  '/book-shoot': () => import('@/pages/BookShoot'),
};
const loading = new Map<string, Promise<unknown>>();
export function prefetchRoute(path: string) {
  const load = routes[path];
  if (!load || loading.has(path)) return;
  loading.set(path, load().catch(() => { loading.delete(path); }));
}
