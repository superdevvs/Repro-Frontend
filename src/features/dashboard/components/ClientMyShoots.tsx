import React, { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, CalendarPlus, Download, Ghost, Image as ImageIcon, Inbox, LayoutGrid, List } from "lucide-react";

import { Card } from "@/components/dashboard/v2/SharedComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isClientDeliveredShootDownloaded,
  isClientDeliveredShootViewed,
  markClientDeliveredShootDownloaded,
  markClientDeliveredShootViewed,
} from "@/utils/clientDeliveredShootTracker";
import type { ClientShootRecord } from "@/utils/dashboardDerivedUtils";
import { shootDataToSummary } from "@/utils/dashboardDerivedUtils";
import { SHOOT_MEDIA_DOWNLOAD_STARTED_EVENT } from "@/utils/shootMediaDownload";

import type { ClientMyShootsProps } from "../types";
import { getClientDeliveredMedia } from "../utils";
import { ClientPaymentPill } from "./ClientPaymentPill";
import { ClientShootTile } from "./ClientShootTile";
import { DevProfiler } from "./DevProfiler";

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
}) => {
  const tabs: Array<{ key: "upcoming" | "completed" | "hold"; label: string; count: number }> = [
    { key: "upcoming", label: "Scheduled", count: upcoming.length },
    { key: "completed", label: "Delivered", count: completed.length },
    // Only show On hold tab if there are items
    ...(onHold.length > 0 ? [{ key: "hold" as const, label: "On hold", count: onHold.length }] : []),
  ];
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("upcoming");
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

  const markDeliveredShootViewed = useCallback((record: ClientShootRecord) => {
    if (!normalizedCurrentUserId) {
      return;
    }

    if (markClientDeliveredShootViewed(normalizedCurrentUserId, record.data.id)) {
      setDeliveredTrackerVersion((version) => version + 1);
    }
  }, [normalizedCurrentUserId]);

  const deliveredBadgeState = !normalizedCurrentUserId
    ? {
        remainingCount: completed.length,
        unseenCount: completed.length,
      }
    : completed.reduce(
        (accumulator, record) => {
          const shootId = record.data.id;
          const isDownloaded = isClientDeliveredShootDownloaded(normalizedCurrentUserId, shootId);
          const isViewed = isClientDeliveredShootViewed(normalizedCurrentUserId, shootId);

          if (!isDownloaded) {
            accumulator.remainingCount += 1;
          }

          if (!isDownloaded && !isViewed) {
            accumulator.unseenCount += 1;
          }

          return accumulator;
        },
        { remainingCount: 0, unseenCount: 0 },
      );

  const handleSelectRecord = useCallback((record: ClientShootRecord) => {
    if (activeTab === "completed") {
      markDeliveredShootViewed(record);
    }
    onSelect(record);
  }, [activeTab, markDeliveredShootViewed, onSelect]);

  const handleDownloadRecord = useCallback((record: ClientShootRecord) => {
    markDeliveredShootViewed(record);
    onDownload(record);
  }, [markDeliveredShootViewed, onDownload]);

  const list =
    activeTab === "upcoming" ? upcoming : activeTab === "completed" ? completed : onHold;

  return (
    <DevProfiler id="ClientMyShoots">
      <Card className="flex h-full flex-1 min-h-0 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground">My shoots</h2>
            <div className="flex items-center gap-1">
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
                        {deliveredBadgeState.remainingCount}
                      </span>
                    ) : (
                      <span>({tab.count})</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2" data-onboarding-target="client-dashboard-requests">
            {onOpenRequests && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 rounded-full px-3 text-xs"
                onClick={onOpenRequests}
              >
                <Inbox className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Requests</span>
                <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                  {requestsLoading ? "…" : activeRequestCount}
                </Badge>
              </Button>
            )}
            {activeTab === "completed" && list.length > 0 && (
              <div className="flex items-center border rounded-md overflow-hidden">
                <button
                  onClick={() => toggleDeliveredView('grid')}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${deliveredViewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                  title="Grid view"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleDeliveredView('list')}
                  className={`h-7 w-7 flex items-center justify-center transition-colors ${deliveredViewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-col">
          {list.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {activeTab === "upcoming" && "No scheduled shoots"}
                {activeTab === "completed" && "No delivered shoots yet"}
                {activeTab === "hold" && "No shoots on hold"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                {activeTab === "upcoming" && "You don't have any shoots scheduled. Book a new shoot to get started!"}
                {activeTab === "completed" && "Once your shoots are delivered, they'll appear here."}
                {activeTab === "hold" && "Shoots requiring your attention will appear here."}
              </p>
              {(activeTab === "upcoming" || activeTab === "completed") && (
                <Button onClick={onBookNewShoot} className="gap-2">
                  <CalendarPlus className="h-4 w-4" />
                  Book New Shoot
                </Button>
              )}
            </div>
          ) : (
            <div className="hidden-scrollbar md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1">
              {activeTab === "completed" && deliveredViewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((record) => {
                    const summary = shootDataToSummary(record.data);
                    const deliveredMedia = getClientDeliveredMedia(record.data);
                    const coverPhoto = deliveredMedia.coverPhoto;
                    const photoCount = deliveredMedia.count;
                    const dateLabel = summary.startTime
                      ? format(new Date(summary.startTime), "d MMM yyyy")
                      : "No date";
                    const paymentStatus = summary.paymentStatus ?? "unpaid";
                    return (
                      <div
                        key={record.data.id}
                        className="group relative rounded-xl overflow-hidden cursor-pointer border border-border hover:border-primary/40 transition-all hover:shadow-lg"
                        onClick={() => handleSelectRecord(record)}
                      >
                        {coverPhoto ? (
                          <img
                            src={coverPhoto}
                            alt={summary.addressLine}
                            className="w-full aspect-[4/3] object-cover transition-transform group-hover:scale-105"
                            onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).className = 'w-full aspect-[4/3] bg-muted'; }}
                          />
                        ) : (
                          <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        {photoCount > 0 && (
                          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
                            {photoCount} photo{photoCount !== 1 ? 's' : ''}
                          </div>
                        )}
                        <button
                          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); handleDownloadRecord(record); }}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h3 className="text-white font-semibold text-sm truncate">{summary.addressLine}</h3>
                          <p className="text-white/70 text-[11px] mt-0.5">{dateLabel}</p>
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-green-500/30 text-green-300 border-green-500/40 text-[9px] h-4 px-1.5">
                                <span className="w-1 h-1 rounded-full bg-green-400 mr-1" />
                                DELIVERED
                              </Badge>
                              {record.data.isGhostVisibleForUser ? (
                                <Badge className="bg-slate-900/55 text-slate-100 border-white/15 text-[9px] h-4 px-1.5">
                                  <Ghost className="mr-1 h-2.5 w-2.5" />
                                  GHOST
                                </Badge>
                              ) : null}
                            </div>
                            <ClientPaymentPill status={paymentStatus} overlay />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
      prevProps.onOpenRequests === nextProps.onOpenRequests
    );
  }
);
