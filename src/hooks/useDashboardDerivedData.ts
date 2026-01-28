import { useCallback, useMemo } from "react";

import type { DashboardShootSummary, DashboardPhotographerSummary } from "@/types/dashboard";
import type { ShootData } from "@/types/shoots";
import type { UserData } from "@/types/auth";
import type { ClientShootRecord } from "@/utils/dashboardDerivedUtils";
import {
  buildClientInvoiceSummary,
  buildPhotographerSummariesFromShoots,
  doesShootBelongToClient,
  extractMetadataArray,
  extractStateToken,
  filterCompletedShoots,
  filterDeliveredShoots,
  filterPendingReviews,
  filterRequestedShoots,
  filterUpcomingShoots,
  isAssignmentMatch,
  isCanceledSummary,
  isCompletedSummary,
  isOnHoldRecord,
  shootDataToSummary,
  sortByStartAsc,
  sortByStartDesc,
} from "@/utils/dashboardDerivedUtils";

interface UseDashboardDerivedDataParams {
  shoots: ShootData[];
  role?: string;
  user: UserData | null;
}

interface RepScope {
  clientIds: string[];
  clientNames: string[];
  regions: string[];
  hasScope: boolean;
}

interface UseDashboardDerivedDataResult {
  summaryMap: Map<string, DashboardShootSummary>;
  allSummaries: DashboardShootSummary[];
  photographerSourceShoots: ShootData[];
  editorSourceShoots: ShootData[];
  photographerSummaries: DashboardShootSummary[];
  editorSummaries: DashboardShootSummary[];
  editorUpcoming: DashboardShootSummary[];
  photographerUpcoming: DashboardShootSummary[];
  photographerCompleted: DashboardShootSummary[];
  photographerDelivered: DashboardShootSummary[];
  photographerPendingReviews: DashboardShootSummary[];
  editorCompleted: DashboardShootSummary[];
  editorPendingReviews: DashboardShootSummary[];
  requestedShoots: DashboardShootSummary[];
  upcomingShootsWithoutRequested: DashboardShootSummary[];
  editorDelivered: DashboardShootSummary[];
  clientShoots: ShootData[];
  clientRecords: ClientShootRecord[];
  clientUpcomingRecords: ClientShootRecord[];
  clientCompletedRecords: ClientShootRecord[];
  clientOnHoldRecords: ClientShootRecord[];
  repScope: RepScope;
  repVisibleSummaries: DashboardShootSummary[];
  repSourceShoots: ShootData[];
  repUpcoming: DashboardShootSummary[];
  repPendingReviews: DashboardShootSummary[];
  repDelivered: DashboardShootSummary[];
  clientLatestCompleted: ClientShootRecord | null;
  clientInvoiceSummary: {
    dueNow: { amount: number; count: number };
    upcoming: { amount: number; count: number };
    paid: { amount: number; count: number };
  };
  fallbackPhotographers: DashboardPhotographerSummary[];
}

export const useDashboardDerivedData = ({
  shoots,
  role,
  user,
}: UseDashboardDerivedDataParams): UseDashboardDerivedDataResult => {
  // Memoize shoot summaries with stable references
  // Always regenerate summaries when shoots change to ensure updates are reflected
  const summaryMap = useMemo(() => {
    const map = new Map<string, DashboardShootSummary>();
    shoots.forEach((shoot) => {
      // Always regenerate summary to ensure it reflects latest shoot data
      // The WeakMap cache in shootDataToSummary will still help with performance
      map.set(String(shoot.id), shootDataToSummary(shoot));
    });
    return map;
  }, [shoots]);

  // Optimize toSummaryList to avoid creating new arrays unnecessarily
  const toSummaryList = useCallback(
    (source: ShootData[]): DashboardShootSummary[] => {
      if (!source.length) return [];
      const summaries: DashboardShootSummary[] = [];
      for (const shoot of source) {
        const summary = summaryMap.get(shoot.id);
        if (summary) summaries.push(summary);
      }
      return summaries;
    },
    [summaryMap],
  );

  // Memoize all summaries with stable reference
  const allSummaries = useMemo(() => {
    const summaries = Array.from(summaryMap.values());
    return summaries;
  }, [summaryMap]);

  // Memoize assignment matching with stable user ID reference
  const userId = user?.id;
  const photographerSourceShoots = useMemo(
    () => {
      if (!userId) return [];
      if (role === 'photographer') return shoots;
      return shoots.filter((shoot) => isAssignmentMatch(shoot, user, "photographer"));
    },
    [role, shoots, user, userId],
  );
  const editorSourceShoots = useMemo(
    () => {
      if (!userId) return [];
      if (role === 'editor') return shoots;
      return shoots.filter((shoot) => isAssignmentMatch(shoot, user, "editor"));
    },
    [role, shoots, user, userId],
  );

  const photographerSummaries = useMemo(
    () => toSummaryList(photographerSourceShoots),
    [photographerSourceShoots, toSummaryList],
  );
  const editorSummaries = useMemo(
    () => toSummaryList(editorSourceShoots),
    [editorSourceShoots, toSummaryList],
  );
  const editorUpcoming = useMemo(() => filterUpcomingShoots(editorSummaries, role), [editorSummaries, role]);

  const photographerUpcoming = useMemo(
    () => filterUpcomingShoots(photographerSummaries, role),
    [photographerSummaries, role],
  );
  const photographerCompleted = useMemo(
    () => filterCompletedShoots(photographerSummaries),
    [photographerSummaries],
  );
  const photographerDelivered = useMemo(
    () => filterDeliveredShoots(photographerSummaries),
    [photographerSummaries],
  );
  const photographerPendingReviews = useMemo(
    () => filterPendingReviews(photographerSummaries),
    [photographerSummaries],
  );

  const editorPendingReviews = useMemo(() => filterPendingReviews(editorSummaries), [editorSummaries]);
  const editorCompleted = useMemo(() => filterCompletedShoots(editorSummaries), [editorSummaries]);

  // Requested shoots for admin/rep dashboard - component handles past/present filtering
  const requestedShoots = useMemo(() => filterRequestedShoots(allSummaries), [allSummaries]);

  // Filter out requested shoots from upcoming shoots data for UpcomingShootsCard
  // Use allSummaries (from context) instead of data?.upcomingShoots so it updates immediately
  const upcomingShootsWithoutRequested = useMemo(() => {
    // Use allSummaries from context which updates immediately when context changes
    const upcoming = filterUpcomingShoots(allSummaries, role);
    const filtered = upcoming.filter((shoot) => {
      const statusKey = (shoot.workflowStatus || shoot.status || "").toLowerCase();
      return !statusKey.includes("requested");
    });
    return filtered;
  }, [allSummaries, role]);

  const editorDelivered = useMemo(() => filterDeliveredShoots(editorSummaries), [editorSummaries]);

  // Optimize client shoots filtering
  const clientShoots = useMemo(() => {
    if (role !== "client" || !user) return [];
    // Filter to only show shoots belonging to this client
    return shoots.filter((shoot) => doesShootBelongToClient(shoot, user));
  }, [role, shoots, user]);

  const clientRecords = useMemo(() => {
    if (!clientShoots.length) return [];
    return clientShoots
      .map((shoot) => {
        const summary = summaryMap.get(shoot.id);
        if (!summary) return null;
        return { data: shoot, summary };
      })
      .filter((record): record is ClientShootRecord => Boolean(record));
  }, [clientShoots, summaryMap]);

  const clientUpcomingRecords = useMemo(() => {
    return clientRecords
      .filter(
        (record) =>
          !isCompletedSummary(record.summary) &&
          !isCanceledSummary(record.summary) &&
          !isOnHoldRecord(record),
      )
      .sort((a, b) => sortByStartAsc(a.summary, b.summary));
  }, [clientRecords]);

  const clientCompletedRecords = useMemo(() => {
    return clientRecords
      .filter((record) => isCompletedSummary(record.summary))
      .sort((a, b) => sortByStartDesc(a.summary, b.summary));
  }, [clientRecords]);

  const clientOnHoldRecords = useMemo(() => {
    return clientRecords
      .filter((record) => isOnHoldRecord(record))
      .sort((a, b) => sortByStartAsc(a.summary, b.summary));
  }, [clientRecords]);

  const repScope = useMemo(() => {
    const metadata = (user?.metadata as Record<string, unknown>) || {};
    const clientIds = extractMetadataArray(metadata, ["managedClientIds", "clientIds"]).map((value) =>
      value.toString(),
    );
    const clientNames = extractMetadataArray(
      metadata,
      ["managedClientNames", "clientNames"],
      (value) => value.toLowerCase(),
    );
    const regions = extractMetadataArray(
      metadata,
      ["regions", "managedRegions", "territories"],
      (value) => value.toLowerCase(),
    );
    const hasScope = clientIds.length > 0 || clientNames.length > 0 || regions.length > 0;
    return { clientIds, clientNames, regions, hasScope };
  }, [user?.metadata]);

  // Optimize rep visible summaries filtering
  const repVisibleSummaries = useMemo(() => {
    if (!repScope.hasScope) return allSummaries;
    const { clientIds, clientNames, regions } = repScope;
    // Early return if no filters
    if (!clientIds.length && !clientNames.length && !regions.length) return allSummaries;

    return allSummaries.filter((shoot) => {
      // Check client ID first (most efficient)
      if (clientIds.length && shoot.clientId && clientIds.includes(String(shoot.clientId))) {
        return true;
      }
      // Check client name
      if (clientNames.length) {
        const clientName = shoot.clientName?.toLowerCase();
        if (clientName && clientNames.includes(clientName)) {
          return true;
        }
      }
      // Check region
      if (regions.length) {
        const stateToken = extractStateToken(shoot.cityStateZip);
        if (stateToken && regions.includes(stateToken)) {
          return true;
        }
      }
      return false;
    });
  }, [allSummaries, repScope]);

  // Optimize rep source shoots filtering
  const repSourceShoots = useMemo(() => {
    if (!repScope.hasScope) return shoots;
    const { clientIds, clientNames, regions } = repScope;
    // Early return if no filters
    if (!clientIds.length && !clientNames.length && !regions.length) return shoots;

    return shoots.filter((shoot) => {
      // Check client ID first (most efficient)
      if (clientIds.length && shoot.client?.id && clientIds.includes(String(shoot.client.id))) {
        return true;
      }
      // Check client name
      if (clientNames.length) {
        const clientName = shoot.client?.name?.toLowerCase();
        if (clientName && clientNames.includes(clientName)) {
          return true;
        }
      }
      // Check region
      if (regions.length) {
        const stateToken = shoot.location?.state?.toLowerCase();
        if (stateToken && regions.includes(stateToken)) {
          return true;
        }
      }
      return false;
    });
  }, [repScope, shoots]);

  const repUpcoming = useMemo(() => filterUpcomingShoots(repVisibleSummaries, role), [repVisibleSummaries, role]);
  const repPendingReviews = useMemo(() => filterPendingReviews(repVisibleSummaries), [repVisibleSummaries]);
  const repDelivered = useMemo(() => filterDeliveredShoots(repVisibleSummaries), [repVisibleSummaries]);

  const clientLatestCompleted = clientCompletedRecords[0] ?? null;

  const clientInvoiceSummary = useMemo(() => {
    // Always use shoots-based calculation as it correctly categorizes based on shoot status
    // Delivered unpaid → Due Now, Scheduled/Requested unpaid → Upcoming
    return buildClientInvoiceSummary(clientShoots);
  }, [clientShoots]);

  const fallbackPhotographers = useMemo(
    () => buildPhotographerSummariesFromShoots(shoots),
    [shoots],
  );

  return {
    summaryMap,
    allSummaries,
    photographerSourceShoots,
    editorSourceShoots,
    photographerSummaries,
    editorSummaries,
    editorUpcoming,
    photographerUpcoming,
    photographerCompleted,
    photographerDelivered,
    photographerPendingReviews,
    editorCompleted,
    editorPendingReviews,
    requestedShoots,
    upcomingShootsWithoutRequested,
    editorDelivered,
    clientShoots,
    clientRecords,
    clientUpcomingRecords,
    clientCompletedRecords,
    clientOnHoldRecords,
    repScope,
    repVisibleSummaries,
    repSourceShoots,
    repUpcoming,
    repPendingReviews,
    repDelivered,
    clientLatestCompleted,
    clientInvoiceSummary,
    fallbackPhotographers,
  };
};
