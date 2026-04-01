import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLinkedSharedVisibility } from '@/hooks/useLinkedSharedVisibility';
import { fetchMyLinkedOwners, fetchMySharedData } from '@/services/accountLinkingService';
import type { SharedDetails } from '@/types/auth';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarDays,
  Camera,
  FileText,
  Link2,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

const SHARE_OPTIONS: Array<{ key: keyof SharedDetails; label: string; description: string }> = [
  { key: 'shoots', label: 'Shoots', description: 'Job history and property activity' },
  { key: 'invoices', label: 'Invoices', description: 'Billing totals and payment context' },
  { key: 'clients', label: 'Client data', description: 'Contact records and linked context' },
  { key: 'availability', label: 'Availability', description: 'Scheduling visibility' },
  { key: 'settings', label: 'Settings', description: 'Operational account settings' },
  { key: 'profile', label: 'Profile', description: 'Branding and profile details' },
  { key: 'documents', label: 'Documents', description: 'Files and attachments' },
];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatDateTime = (value?: string | null) => {
  if (!value) return 'No recent activity';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const formatRelative = (value?: string | null) => {
  if (!value) return 'No recent activity';

  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return 'Recently';
  }
};

const SharedLoadingState = () => (
  <DashboardLayout>
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-[28rem] max-w-full" />
        </div>
        <Skeleton className="h-11 w-48 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <Skeleton className="h-[420px] rounded-3xl" />
        <Skeleton className="h-[420px] rounded-3xl" />
      </div>
    </div>
  </DashboardLayout>
);

export default function Shared() {
  const { role, user } = useAuth();
  const isClient = String(role || '').toLowerCase() === 'client';
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedOwnerId = searchParams.get('owner') || '';

  const visibility = useLinkedSharedVisibility();

  const ownersQuery = useQuery({
    queryKey: ['shared-linked-owners', user?.id ?? null],
    queryFn: ({ signal }) => fetchMyLinkedOwners(signal),
    enabled: isClient && visibility.data.hasLinkedAccounts,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const owners = ownersQuery.data?.linkedAccounts ?? visibility.data.linkedAccounts ?? [];

  useEffect(() => {
    if (!owners.length) return;
    if (selectedOwnerId && owners.some((owner) => owner.id === selectedOwnerId)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('owner', owners[0].id);
    setSearchParams(nextParams, { replace: true });
  }, [owners, searchParams, selectedOwnerId, setSearchParams]);

  const sharedQuery = useQuery({
    queryKey: ['shared-owner-data', user?.id ?? null, selectedOwnerId],
    queryFn: ({ signal }) => fetchMySharedData(selectedOwnerId, signal),
    enabled: isClient && Boolean(selectedOwnerId) && visibility.data.hasLinkedAccounts,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const enabledCategories = useMemo(
    () => SHARE_OPTIONS.filter((option) => sharedQuery.data?.link.sharedDetails[option.key]),
    [sharedQuery.data],
  );

  if (!isClient) {
    return <Navigate to="/dashboard" replace />;
  }

  if (visibility.loading) {
    return <SharedLoadingState />;
  }

  if (!visibility.data.hasLinkedAccounts) {
    return <Navigate to="/dashboard" replace />;
  }

  const selectedOwner = owners.find((owner) => owner.id === selectedOwnerId) ?? owners[0] ?? null;
  const ownerData = sharedQuery.data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(79,168,255,0.16),_transparent_32%),linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(248,250,252,0.96))] p-5 shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(180deg,_rgba(2,6,23,0.92),_rgba(15,23,42,0.96))] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                <Link2 className="h-3.5 w-3.5" />
                Shared
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                View what each linked owner has shared with you.
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Switch owners to inspect only their shared shoots, billing context, and enabled access categories.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={selectedOwner?.id}
                onValueChange={(value) => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set('owner', value);
                  setSearchParams(nextParams, { replace: true });
                }}
              >
                <SelectTrigger className="h-11 min-w-[240px] rounded-2xl bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Select linked owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name} · {owner.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="h-11 rounded-2xl"
                onClick={() => {
                  void ownersQuery.refetch();
                  if (selectedOwnerId) {
                    void sharedQuery.refetch();
                  }
                }}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', sharedQuery.isFetching || ownersQuery.isFetching ? 'animate-spin' : '')} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Owner</p>
              <p className="mt-3 truncate text-lg font-semibold text-slate-900 dark:text-white">
                {selectedOwner?.name || 'No owner selected'}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{selectedOwner?.email || 'Pick a linked owner'}</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Shoots</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {ownerData?.sharedData.totalShoots ?? 0}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Owner-scoped total</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Spent</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {currencyFormatter.format(ownerData?.sharedData.totalSpent ?? 0)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Invoice-enabled total</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Last activity</p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {formatRelative(ownerData?.sharedData.lastActivity)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(ownerData?.sharedData.lastActivity)}</p>
            </div>
          </div>
        </section>

        {sharedQuery.isLoading ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <Skeleton className="h-[460px] rounded-3xl" />
            <Skeleton className="h-[460px] rounded-3xl" />
          </div>
        ) : sharedQuery.error ? (
          <Card className="rounded-3xl border-red-200 bg-red-50 dark:border-red-950/60 dark:bg-red-950/20">
            <CardContent className="flex items-start gap-3 p-5 text-sm text-red-700 dark:text-red-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Unable to load shared data for this owner.</p>
                <p className="mt-1">{sharedQuery.error instanceof Error ? sharedQuery.error.message : 'Please try again.'}</p>
              </div>
            </CardContent>
          </Card>
        ) : !ownerData ? (
          <Card className="rounded-3xl">
            <CardContent className="p-10 text-center">
              <Link2 className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-base font-semibold">No owner selected</p>
              <p className="mt-2 text-sm text-muted-foreground">Choose a linked owner to load their shared view.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
            <div className="space-y-6">
              {ownerData.link.sharedDetails.shoots && (
                <Card className="rounded-3xl border-slate-200/70 dark:border-slate-800">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Camera className="h-5 w-5" />
                      Recent shoots
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Latest shoot activity shared by {ownerData.owner.name}.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ownerData.sharedData.sharedShoots.length === 0 ? (
                      <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        No shared shoots are available from this owner yet.
                      </div>
                    ) : (
                      ownerData.sharedData.sharedShoots.map((shoot) => (
                        <div key={shoot.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 gap-4">
                            <div className="h-16 w-24 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-900">
                              {shoot.heroImage ? (
                                <img src={shoot.heroImage} alt={shoot.address} className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-slate-400">
                                  <Camera className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{shoot.address}</p>
                              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {[shoot.city, shoot.state].filter(Boolean).join(', ') || 'Location unavailable'}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {shoot.scheduledDate || 'Date unavailable'}
                                </span>
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 capitalize">
                            {shoot.status || 'Shared'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              {ownerData.link.sharedDetails.invoices && (
                <Card className="rounded-3xl border-slate-200/70 dark:border-slate-800">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5" />
                      Recent payments
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Invoice activity shared by this owner.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ownerData.sharedData.paymentHistory.length === 0 ? (
                      <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        No payment history is shared from this owner yet.
                      </div>
                    ) : (
                      ownerData.sharedData.paymentHistory.map((payment) => (
                        <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {currencyFormatter.format(payment.amount)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDateTime(payment.created_at)}
                              {payment.shoot?.address ? ` · ${payment.shoot.address}` : ''}
                            </p>
                          </div>
                          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 capitalize">
                            {payment.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              {ownerData.link.sharedDetails.shoots && (
                <Card className="rounded-3xl border-slate-200/70 dark:border-slate-800">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building2 className="h-5 w-5" />
                      Properties
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Property activity associated with this owner’s shared shoots.
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {ownerData.sharedData.properties.length === 0 ? (
                      <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground md:col-span-2">
                        No properties are shared from this owner yet.
                      </div>
                    ) : (
                      ownerData.sharedData.properties.map((property, index) => (
                        <div key={`${property.address}-${index}`} className="rounded-2xl border border-slate-200/70 p-4 dark:border-slate-800">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{property.address}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[property.city, property.state].filter(Boolean).join(', ') || 'Location unavailable'}
                          </p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {property.shootCount} shoot{property.shootCount === 1 ? '' : 's'}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="rounded-3xl border-slate-200/70 dark:border-slate-800">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Owner details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                    <p className="text-xl font-semibold text-slate-900 dark:text-white">{ownerData.owner.name}</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {ownerData.owner.email}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full px-3 py-1 uppercase">
                        {ownerData.owner.role}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        Linked {formatRelative(ownerData.link.linkedAt)}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Shared access</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {enabledCategories.map((option) => (
                        <Badge key={option.key} variant="secondary" className="rounded-full px-3 py-1.5">
                          {option.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
