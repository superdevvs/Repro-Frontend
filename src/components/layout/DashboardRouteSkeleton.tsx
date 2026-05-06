import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type DashboardRouteSkeletonProps = {
  pathname: string;
};

const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn('rounded-2xl border border-border/60 bg-card/45 p-4', className)}>
    {children}
  </div>
);

const HeaderSkeleton = ({ actions = true }: { actions?: boolean }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-56 max-w-[70vw]" />
      <Skeleton className="h-4 w-80 max-w-[82vw]" />
    </div>
    {actions && (
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-32" />
      </div>
    )}
  </div>
);

const StatCards = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, index) => (
      <Panel key={index} className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-8" />
        </div>
        <Skeleton className="h-8 w-16" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </Panel>
    ))}
  </div>
);

const Rows = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/35 p-3"
      >
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="hidden h-8 w-24 sm:block" />
      </div>
    ))}
  </div>
);

const TabStrip = ({ count = 4 }: { count?: number }) => (
  <div className="flex flex-wrap gap-2">
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className={cn('h-10 rounded-full', index === 0 ? 'w-28' : 'w-36')} />
    ))}
  </div>
);

const DashboardMetricCardSkeleton = () => (
  <div className="min-h-36 rounded-xl border border-border/60 bg-background/45 p-4">
    <div className="flex items-start justify-between">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-4 w-5" />
    </div>
    <div className="mt-5 space-y-3">
      <Skeleton className="h-8 w-10" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

const DashboardStatsPanelSkeleton = () => (
  <Panel className="rounded-3xl p-5">
    <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: 4 }).map((_, index) => (
        <DashboardMetricCardSkeleton key={index} />
      ))}
    </div>
  </Panel>
);

const DashboardMobileTabsSkeleton = () => (
  <div className="sticky top-[-0.75rem] z-20 -mx-2 px-2 pb-1">
    <div className="overflow-x-hidden">
      <div className="inline-flex max-w-full gap-2 rounded-full border border-border/50 bg-background/80 py-1.5 pl-1.5 pr-3 backdrop-blur">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  </div>
);

const DashboardMobileShootsPanelSkeleton = () => (
  <Panel className="min-w-0 space-y-4 overflow-hidden rounded-3xl p-3">
    <div className="flex items-center justify-between gap-3 pr-10">
      <div className="flex min-w-0 items-center gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-20" />
      </div>
      <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />
    </div>
    <div className="space-y-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {Array.from({ length: 2 }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="space-y-2.5 rounded-3xl border border-border bg-card px-5 pb-3.5 pt-4">
            <div className="flex items-start gap-2">
              <Skeleton className="h-7 w-36 flex-shrink-0 rounded-xl" />
              <Skeleton className="ml-auto h-5 w-16 flex-shrink-0 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full max-w-[260px]" />
              <Skeleton className="h-3 w-full max-w-[180px]" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-20 flex-shrink-0 rounded-full" />
              <Skeleton className="h-3 w-36 max-w-[45%]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </Panel>
);

const AssignPhotographersSkeleton = () => (
  <Panel className="overflow-hidden rounded-3xl p-0">
    <div className="space-y-4 p-5">
      <Skeleton className="h-6 w-52" />
      <div className="flex h-9 items-center gap-6 rounded-xl bg-muted/35 px-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="grid h-9 grid-cols-3 gap-2 rounded-xl bg-muted/30 p-1">
        <Skeleton className="h-full rounded-lg" />
        <Skeleton className="h-full rounded-lg" />
        <Skeleton className="h-full rounded-lg" />
      </div>
    </div>
    <div className="border-t border-border/50 p-4">
      <Rows count={4} />
    </div>
  </Panel>
);

const DashboardSkeleton = () => (
  <div className="space-y-2.5 px-2 pb-3 pt-1.5 sm:space-y-6 sm:p-6">
    <HeaderSkeleton actions={false} />
    <div className="space-y-2 sm:hidden">
      <DashboardMobileTabsSkeleton />
      <DashboardMobileShootsPanelSkeleton />
    </div>
    <div className="hidden gap-6 sm:grid xl:grid-cols-[380px_minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <DashboardStatsPanelSkeleton />
        <AssignPhotographersSkeleton />
      </div>
      <Panel className="min-h-[420px] space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-24" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </Panel>
      <div className="space-y-6">
        <Panel className="space-y-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </Panel>
        <Panel className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </Panel>
      </div>
    </div>
  </div>
);

const BookShootSkeleton = () => (
  <div className="space-y-6 px-1 py-4 sm:px-4 sm:py-6 lg:p-6">
    <HeaderSkeleton />
    <Panel className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </Panel>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="space-y-5">
        <Skeleton className="h-7 w-44" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </Panel>
      <Panel className="hidden space-y-4 xl:block">
        <Skeleton className="h-6 w-40" />
        <Rows count={4} />
        <Skeleton className="h-12 w-full rounded-xl" />
      </Panel>
    </div>
  </div>
);

const ShootHistorySkeleton = () => (
  <div className="space-y-5 px-2 py-4 sm:p-6">
    <HeaderSkeleton />
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <TabStrip count={4} />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Panel key={index} className="space-y-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </Panel>
      ))}
    </div>
  </div>
);

const AccountsSkeleton = () => (
  <div className="space-y-4 px-2 py-4 sm:p-6">
    <HeaderSkeleton />
    <TabStrip count={3} />
    <TabStrip count={7} />
    <Panel className="space-y-3">
      <div className="hidden grid-cols-[2fr_1fr_1fr_120px] gap-4 px-3 sm:grid">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Rows count={7} />
    </Panel>
  </div>
);

const AccountingSkeleton = () => (
  <div className="space-y-5 px-2 py-4 sm:p-6">
    <HeaderSkeleton />
    <TabStrip count={5} />
    <StatCards count={4} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel className="space-y-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </Panel>
      <Panel className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <Rows count={5} />
      </Panel>
    </div>
  </div>
);

const AvailabilitySkeleton = () => (
  <div className="flex min-h-full flex-col gap-4 p-1 sm:p-3">
    <HeaderSkeleton />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-10 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
    <div className="grid min-h-[520px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <Panel className="space-y-3">
        <Skeleton className="h-6 w-36" />
        <Rows count={6} />
      </Panel>
      <Panel className="space-y-3">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square min-h-16 rounded-xl" />
          ))}
        </div>
      </Panel>
      <Panel className="hidden space-y-4 xl:block">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </Panel>
    </div>
  </div>
);

const AiEditingSkeleton = () => (
  <div className="space-y-5 px-2 py-4 sm:p-6">
    <HeaderSkeleton />
    <TabStrip count={5} />
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <Skeleton className="h-10 w-full md:w-80" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Panel className="space-y-3">
        <Rows count={6} />
      </Panel>
      <Panel className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      </Panel>
    </div>
  </div>
);

const MessagingSkeleton = () => (
  <div className="space-y-5 px-2 py-4 pb-24 sm:p-6">
    <HeaderSkeleton />
    <StatCards count={4} />
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Panel className="space-y-3">
        <Skeleton className="h-6 w-36" />
        <Rows count={5} />
      </Panel>
      <Panel className="space-y-3">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-10 w-28" />
        </div>
        <Rows count={7} />
      </Panel>
    </div>
  </div>
);

const SmsSkeleton = () => (
  <div className="flex h-[calc(100vh-5rem)] min-h-[520px] gap-0 overflow-hidden rounded-3xl border border-border/60 bg-card/35">
    <div className="w-full max-w-sm space-y-3 border-r border-border/60 p-4">
      <Skeleton className="h-10 w-full" />
      <Rows count={8} />
    </div>
    <div className="hidden min-w-0 flex-1 flex-col md:flex">
      <div className="border-b border-border/60 p-4">
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-20 w-3/5 rounded-2xl" />
        <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl" />
      </div>
      <div className="border-t border-border/60 p-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
    <div className="hidden w-80 space-y-4 border-l border-border/60 p-4 xl:block">
      <Skeleton className="h-16 w-16 rounded-full" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-56" />
      <Rows count={4} />
    </div>
  </div>
);

const ChatSkeleton = () => (
  <div className="flex min-h-full flex-col bg-background">
    <div className="flex items-center justify-between border-b border-border/60 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <Skeleton className="h-20 w-3/4 rounded-2xl" />
      <Skeleton className="ml-auto h-24 w-2/3 rounded-2xl" />
      <Skeleton className="h-16 w-1/2 rounded-2xl" />
      <div className="mt-auto">
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  </div>
);

const ShootDetailsSkeleton = () => (
  <div className="grid min-h-full gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-7 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <TabStrip count={5} />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
    <div className="hidden space-y-4 border-l border-border/60 bg-card/25 p-5 lg:block">
      <Skeleton className="h-6 w-44" />
      <Rows count={6} />
    </div>
  </div>
);

const ListingsSkeleton = () => (
  <div className="space-y-5 px-2 py-4 sm:p-6">
    <HeaderSkeleton />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Panel key={index} className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-40" />
        </Panel>
      ))}
    </div>
  </div>
);

const PanelPageSkeleton = () => (
  <div className="space-y-5 px-2 py-4 sm:p-6">
    <HeaderSkeleton />
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Panel className="space-y-3">
        <Rows count={5} />
      </Panel>
      <Panel className="space-y-5">
        <Skeleton className="h-7 w-52" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Rows count={4} />
      </Panel>
    </div>
  </div>
);

export const DashboardRouteSkeleton = ({ pathname }: DashboardRouteSkeletonProps) => {
  if (pathname === '/dashboard') return <DashboardSkeleton />;
  if (pathname === '/book-shoot' || pathname === '/book-shoot-enhanced') return <BookShootSkeleton />;
  if (pathname === '/shoot-history' || pathname === '/photographer-history') return <ShootHistorySkeleton />;
  if (pathname === '/accounts') return <AccountsSkeleton />;
  if (pathname === '/accounting' || pathname === '/invoices') return <AccountingSkeleton />;
  if (pathname === '/availability' || pathname === '/photographer-availability') return <AvailabilitySkeleton />;
  if (pathname === '/ai-editing') return <AiEditingSkeleton />;
  if (pathname === '/messaging/sms') return <SmsSkeleton />;
  if (pathname.startsWith('/messaging')) return <MessagingSkeleton />;
  if (pathname === '/chat-with-reproai') return <ChatSkeleton />;
  if (pathname.startsWith('/shoots/')) return <ShootDetailsSkeleton />;
  if (pathname === '/portal' || pathname.startsWith('/exclusive-listings/')) return <ListingsSkeleton />;

  return <PanelPageSkeleton />;
};
