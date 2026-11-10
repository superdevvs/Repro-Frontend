import { DashboardShootFilters, DashboardFilterChips } from '@/components/dashboard/v2/DashboardShootFilters';
import { defaultFilters, countActiveFilters, getServiceKey } from '@/components/dashboard/v2/shootsTabsCardUtils';
import { matchesDashboardFilters } from '@/components/dashboard/v2/dashboardFilterModel';
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from 'react-dom';
import { CalendarDays, CalendarPlus, Filter, Inbox, LayoutGrid, List } from "lucide-react";

import { Card } from "@/components/dashboard/v2/SharedComponents";
import { DASHBOARD_MOBILE_PANEL_CLASS } from "@/features/dashboard/utils/dashboardMobilePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isClientDeliveredShootDownloaded,
  markClientDeliveredShootDownloaded,
} from "@/utils/clientDeliveredShootTracker";
import type { ClientShootRecord } from "@/utils/dashboardDerivedUtils";
import { SHOOT_MEDIA_DOWNLOAD_STARTED_EVENT } from "@/utils/shootMediaDownload";

import type { ClientMyShootsProps } from "../types";
import { ClientShootTile } from "./ClientShootTile";
import { ClientDeliveredGridCard } from "./ClientDeliveredGridCard";
import { DevProfiler } from "./DevProfiler";
import { DashboardMobileToolbarContext } from './dashboardMobileToolbarContext';

export const ClientMyShoots: React.FC<ClientMyShootsProps> = React.memo(({
  upcoming,
  completed,
  onHold,
  currentUserId,
  onSelect,
  onReschedule,
  onCancel,
  onContactSupport,
  onDownload,
  onRebook,
  onRequestRevision,
  onHoldAction,
  onPayment,
  onBookNewShoot,
  activeRequestCount = 0,
  requestsLoading = false,
  onOpenRequests,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  deliveredUnseenCount = 0,
}) => {
  const mobileToolbarHost = useContext(DashboardMobileToolbarContext);
  const tabs: Array<{ key: "upcoming" | "completed" | "hold"; label: string; count: number }> = [
    { key: "upcoming", label: "Scheduled", count: upcoming.length },
    { key: "completed", label: "Delivered", count: completed.length },
    // Only show On hold tab if there are items
    ...(onHold.length > 0 ? [{ key: "hold" as const, label: "On hold", count: onHold.length }] : []),
  ];
  const [internalActiveTab, setInternalActiveTab] = useState<(typeof tabs)[number]["key"]>("upcoming");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: (typeof tabs)[number]["key"]) => {
    setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  };
  const [deliveredViewMode, setDeliveredViewMode] = useState<'grid' | 'list'>(() => {
    try { return (localStorage.getItem('client-delivered-view') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; }
  });
  const toggleDeliveredView = (mode: 'grid' | 'list') => {
    setDeliveredViewMode(mode);
    try { localStorage.setItem('client-delivered-view', mode); } catch {
      // Ignore storage write failures and keep the selected view in memory.
    }
  };
  const [, setDeliveredTrackerVersion] = useState(0);
  const normalizedCurrentUserId = currentUserId != null ? String(currentUserId) : null;

  useEffect(() => {
    if (!normalizedCurrentUserId || typeof window === "undefined") {
      return;
    }

    const handleDownloadStarted = (event: Event) => {
      const customEvent = event as CustomEvent<{
        shootId?: string;
        type?: "raw" | "edited";
      }>;
      const shootId = customEvent.detail?.shootId;
      const downloadType = customEvent.detail?.type;

      if (!shootId || downloadType !== "edited") {
        return;
      }

      if (!completed.some((record) => String(record.data.id) === String(shootId))) {
        return;
      }

      if (markClientDeliveredShootDownloaded(normalizedCurrentUserId, shootId)) {
        setDeliveredTrackerVersion((version) => version + 1);
      }
    };

    window.addEventListener(
      SHOOT_MEDIA_DOWNLOAD_STARTED_EVENT,
      handleDownloadStarted as EventListener,
    );

    return () => {
      window.removeEventListener(
        SHOOT_MEDIA_DOWNLOAD_STARTED_EVENT,
        handleDownloadStarted as EventListener,
      );
    };
  }, [completed, normalizedCurrentUserId]);

  const deliveredBadgeState = !normalizedCurrentUserId
    ? {
        remainingCount: completed.length,
        unseenCount: deliveredUnseenCount,
      }
    : completed.reduce(
        (accumulator, record) => {
          const shootId = record.data.id;
          const isDownloaded = isClientDeliveredShootDownloaded(normalizedCurrentUserId, shootId);

          if (!isDownloaded) {
            accumulator.remainingCount += 1;
          }

          return accumulator;
        },
        { remainingCount: 0, unseenCount: deliveredUnseenCount },
      );

  const handleSelectRecord = useCallback((record: ClientShootRecord) => {
    onSelect(record);
  }, [onSelect]);

  const handleDownloadRecord = useCallback((record: ClientShootRecord) => {
    onDownload(record);
  }, [onDownload]);

  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterCount = countActiveFilters(filters);
  const serviceOptions = useMemo(() => {
    const options = new Map<string, string>();
    [...upcoming, ...completed, ...onHold].forEach(record => record.summary.services.forEach(service => options.set(getServiceKey(service.label, service.type), service.label)));
    return [...options].map(([key, label]) => ({ key, label }));
  }, [upcoming, completed, onHold]);
  const resetFilters = () => { setFilters(defaultFilters); setDraftFilters(defaultFilters); setIsFilterOpen(false); };
  const list = (activeTab === "upcoming" ? upcoming : activeTab === "completed" ? completed : onHold)
    .filter(record => matchesDashboardFilters(record.summary, filters, 'client'));
  const filterControl = (
    <Button variant="outline" size="icon" className={cn('relative shrink-0 rounded-full', mobileToolbarHost ? 'h-9 w-9' : 'h-8 w-8')} aria-label="Filters" aria-expanded={isFilterOpen} onClick={() => { setDraftFilters(filters); setIsFilterOpen(true); }}>
      <Filter className="h-3.5 w-3.5" />{filterCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary text-[10px] text-primary-foreground">{filterCount}</span>}
    </Button>
  );
  const deliveredViewControls = activeTab === 'completed' && list.length > 0 ? (
    <div role="group" aria-label="Delivered shoot view" className="flex shrink-0 items-center overflow-hidden rounded-full border border-border bg-background">
      {(['grid', 'list'] as const).map(mode => (
        <button key={mode} type="button" onClick={() => toggleDeliveredView(mode)}
          aria-label={mode === 'grid' ? 'Grid view' : 'List view'} aria-pressed={deliveredViewMode === mode}
          title={mode === 'grid' ? 'Grid view' : 'List view'}
          className={cn('flex h-9 w-9 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', deliveredViewMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
          {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <DevProfiler id="ClientMyShoots">
      {mobileToolbarHost && createPortal(<>{deliveredViewControls}{filterControl}</>, mobileToolbarHost)}
      <Card className={cn(DASHBOARD_MOBILE_PANEL_CLASS, "flex h-full flex-1 min-h-0 flex-col overflow-hidden")}>
        <div className="flex shrink-0 items-start justify-between gap-2 mb-4 sm:mb-6">
            <div aria-label="Shoot status" className="hidden-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                    activeTab === tab.key
                      ? "text-foreground border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {tab.label}
                    {tab.key === "completed" && completed.length > 0 ? (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full transition-colors",
                          deliveredBadgeState.unseenCount > 0
                            ? "text-white bg-blue-500 animate-bounce"
                            : "text-slate-700 bg-slate-300",
                        )}
                      >
                        {deliveredBadgeState.unseenCount > 0
                          ? deliveredBadgeState.unseenCount
                          : deliveredBadgeState.remainingCount}
                      </span>
                    ) : (
                      <span>({tab.count})</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2" data-onboarding-target="client-dashboard-requests">
            {!mobileToolbarHost && filterControl}
            {onOpenRequests && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 rounded-full px-3 text-xs"
                aria-label={`Requests (${requestsLoading ? 'loading' : `${activeRequestCount} active`})`}
                onClick={onOpenRequests}
              >
                <Inbox className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Requests</span>
                <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                  {requestsLoading ? "…" : activeRequestCount}
                </Badge>
              </Button>
            )}
            {!mobileToolbarHost && deliveredViewControls}
          </div>
        </div>

        <DashboardShootFilters open={isFilterOpen} role="client" title="Filter my shoots" filters={filters} draft={draftFilters}
          onDraftChange={setDraftFilters} onApply={() => { setFilters(draftFilters); setIsFilterOpen(false); }}
          onCancel={() => { setDraftFilters(filters); setIsFilterOpen(false); }} onReset={resetFilters}
          clientOptions={[]} photographerOptions={[]} serviceOptions={serviceOptions} />
        <DashboardFilterChips filters={filters} onChange={setFilters} onReset={resetFilters} role="client"
          clientOptions={[]} photographerOptions={[]} serviceOptions={serviceOptions} />
        <div className="flex flex-1 min-h-0 flex-col">
          {list.length === 0 ? (
            <div className="hidden-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 text-center">
              <div className="my-auto flex shrink-0 flex-col items-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {filterCount > 0 ? "No shoots match your filters" : activeTab === "upcoming" && "No scheduled shoots"}
                {!filterCount && activeTab === "completed" && "No delivered shoots yet"}
                {!filterCount && activeTab === "hold" && "No shoots on hold"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                {filterCount > 0 ? "Try a different date, status, or service, or clear your filters." : activeTab === "upcoming" && "You don't have any shoots scheduled. Book a new shoot to get started!"}
                {!filterCount && activeTab === "completed" && "Once your shoots are delivered, they'll appear here."}
                {!filterCount && activeTab === "hold" && "Shoots requiring your attention will appear here."}
              </p>
              {filterCount > 0 ? <Button variant="outline" onClick={resetFilters}>Clear all filters</Button> : (activeTab === "upcoming" || activeTab === "completed") && (
                <Button onClick={onBookNewShoot} className="gap-2">
                  <CalendarPlus className="h-4 w-4" />
                  Book New Shoot
                </Button>
              )}
              </div>
            </div>
          ) : (
            <div className="hidden-scrollbar flex-1 min-h-0 overflow-y-auto pr-1">
              {activeTab === "completed" && deliveredViewMode === "grid" ? (
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((record) => (
                    <ClientDeliveredGridCard key={record.data.id} record={record} onSelect={handleSelectRecord} onDownload={handleDownloadRecord} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {list.map((record) => (
                    <ClientShootTile
                      key={record.data.id}
                      record={record}
                      variant={activeTab}
                      onSelect={handleSelectRecord}
                      onReschedule={onReschedule}
                      onCancel={onCancel}
                      onContactSupport={onContactSupport}
                      onDownload={handleDownloadRecord}
                      onRebook={onRebook}
                      onRequestRevision={onRequestRevision}
                      onHoldAction={onHoldAction}
                      onPayment={onPayment}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </Card>
      </DevProfiler>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for ClientMyShoots
    return (
      prevProps.upcoming === nextProps.upcoming &&
      prevProps.completed === nextProps.completed &&
      prevProps.onHold === nextProps.onHold &&
      prevProps.currentUserId === nextProps.currentUserId &&
      prevProps.onSelect === nextProps.onSelect &&
      prevProps.onReschedule === nextProps.onReschedule &&
      prevProps.onCancel === nextProps.onCancel &&
      prevProps.onContactSupport === nextProps.onContactSupport &&
      prevProps.onDownload === nextProps.onDownload &&
      prevProps.onRebook === nextProps.onRebook &&
      prevProps.onRequestRevision === nextProps.onRequestRevision &&
      prevProps.onHoldAction === nextProps.onHoldAction &&
      prevProps.onPayment === nextProps.onPayment &&
      prevProps.onBookNewShoot === nextProps.onBookNewShoot &&
      prevProps.activeRequestCount === nextProps.activeRequestCount &&
      prevProps.requestsLoading === nextProps.requestsLoading &&
      prevProps.onOpenRequests === nextProps.onOpenRequests &&
      prevProps.activeTab === nextProps.activeTab &&
      prevProps.onActiveTabChange === nextProps.onActiveTabChange &&
      prevProps.deliveredUnseenCount === nextProps.deliveredUnseenCount
    );
  }
);
