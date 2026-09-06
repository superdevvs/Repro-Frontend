import { forwardRef, useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { apiClient } from '@/services/api';
import { useAuth } from '@/components/auth/AuthProvider';

interface CachedImage { promise: Promise<string>; url?: string; users: number; timer?: ReturnType<typeof setTimeout> }
const previews = new Map<string, CachedImage>();
let authScope: string | null = null;
const emptyImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';

function isProtectedStudioImage(src: string): boolean {
  try {
    const origin = new URL(apiClient.defaults.baseURL || '/api', window.location.origin);
    const url = new URL(src, window.location.origin);
    const local = ['localhost', '127.0.0.1', '[::1]'];
    return (url.origin === origin.origin || (local.includes(url.hostname) && local.includes(origin.hostname))) && url.pathname.startsWith('/api/');
  } catch { return false; }
}

function acquire(src: string, scope: string): CachedImage {
  // A different login/impersonation must never reuse the previous account's preview.
  if (scope !== authScope) {
    for (const cached of previews.values()) { if (cached.url) URL.revokeObjectURL(cached.url); if (cached.timer) clearTimeout(cached.timer); }
    previews.clear(); authScope = scope;
  }
  let entry = previews.get(src);
  if (!entry) {
    entry = { users: 0, promise: Promise.resolve('') };
    const target = entry;
    const endpoint = new URL(src, window.location.origin);
    target.promise = apiClient.get<Blob>(endpoint.pathname.replace(/^\/api/, '') + endpoint.search, { responseType: 'blob' }).then(response => {
      if (!response.data.type.startsWith('image/')) throw new Error('This file has no image preview.');
      const url = URL.createObjectURL(response.data); target.url = url;
      if (previews.get(src) !== target) { URL.revokeObjectURL(url); throw new Error('The preview session changed.'); }
      return url;
    });
    previews.set(src, target);
  }
  if (entry.timer) clearTimeout(entry.timer);
  entry.users += 1;
  return entry;
}
function release(src: string, entry: CachedImage) {
  entry.users = Math.max(0, entry.users - 1);
  if (!entry.users) entry.timer = setTimeout(() => {
    if (entry.users) return;
    if (entry.url) URL.revokeObjectURL(entry.url);
    if (previews.get(src) === entry) previews.delete(src);
  }, 15_000);
}

/** Authenticated source files use a short-lived object URL; credentials never enter URLs. */
export const StudioImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(function StudioImage({ src = '', onLoad, loading = 'lazy', ...props }, ref) {
  const { user, role, originalUser, isImpersonating } = useAuth();
  const scope = `${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}:${user?.id || ''}:${role}:${isImpersonating ? originalUser?.id : ''}`;
  const protectedImage = isProtectedStudioImage(src);
  const [resolved, setResolved] = useState<{ source: string; scope: string; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(loading === 'eager');
  const element = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (loading === 'eager' || !('IntersectionObserver' in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setInView(true); observer.disconnect(); } }, { rootMargin: '200px' });
    if (element.current) observer.observe(element.current);
    return () => observer.disconnect();
  }, [src, loading]);
  useEffect(() => {
    if (!protectedImage || !src || !inView) return;
    let mounted = true; setFailed(false);
    const entry = acquire(src, scope);
    entry.promise.then(url => { if (mounted) setResolved({ source: src, scope, url }); }).catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; release(src, entry); };
  }, [src, protectedImage, scope, inView]);
  const cached = resolved?.source === src && resolved.scope === scope;
  const ready = !protectedImage || cached;
  return <img {...props} loading={loading} ref={node => { element.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }} src={protectedImage ? cached ? resolved.url : emptyImage : src || emptyImage} aria-busy={!ready && !failed} title={failed ? 'Preview unavailable. Try refreshing the workspace.' : props.title} onLoad={ready ? onLoad : undefined} />;
});
