import type { ReactNode } from 'react';

/** Pages own their section loading states. Requests and images never make the route inert. */
export function PageLoadingBoundary({ children }: { children: ReactNode; bottomInset?: number }) {
  return <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-page-loading="ready">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">{children}</div>
  </div>;
}
