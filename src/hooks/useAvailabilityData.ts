import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, format, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import API_ROUTES from "@/lib/api";
import { API_BASE_URL } from "@/config/env";
import type { BackendSlot, Photographer } from "@/types/availability";
import { mapBackendSlots } from "@/lib/availability/utils";

type ApiRoutesWithPeople = typeof API_ROUTES & {
  people?: {
    photographers?: string;
    adminPhotographers?: string;
  };
};

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

type ViewMode = "day" | "week" | "month";

interface UseAvailabilityDataOptions {
  selectedPhotographer: string;
  setSelectedPhotographer: (value: string) => void;
  date: Date | undefined;
  viewMode: ViewMode;
  role: string | null | undefined;
  userId: number | string | undefined;
  isPhotographer: boolean;
  canManagePhotographerSelection: boolean;
  availabilitySessionScope: string;
  loadingPhotographers?: boolean;
}

export function useAvailabilityData({
  selectedPhotographer,
  setSelectedPhotographer,
  date,
  viewMode,
  userId,
  isPhotographer,
  canManagePhotographerSelection,
  availabilitySessionScope,
}: UseAvailabilityDataOptions) {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [backendSlots, setBackendSlots] = useState<BackendSlot[]>([]);
  const [allBackendSlots, setAllBackendSlots] = useState<BackendSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhotographers, setLoadingPhotographers] = useState(true);
  const [photographerAvailabilityMap, setPhotographerAvailabilityMap] = useState<Record<string, BackendSlot[]>>({});

  const bookedSlotsCacheRef = useRef<Map<string, BackendSlot[]>>(new Map());
  const bulkAvailabilityCacheRef = useRef<{ key: string; data: BackendSlot[]; timestamp: number } | null>(null);
  const listAvailabilityCacheRef = useRef<{ key: string; data: BackendSlot[]; timestamp: number } | null>(null);

  const photographersCacheKey = `photographers_cache:${availabilitySessionScope}`;
  const photographersCacheTimeKey = `photographers_cache_time:${availabilitySessionScope}`;

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  // Reset caches/state when session scope (role/user/impersonation) changes.
  // setSelectedPhotographer is stable from the parent; listing it here would
  // loop the effect. Intentional.
  useEffect(() => {
    bookedSlotsCacheRef.current.clear();
    bulkAvailabilityCacheRef.current = null;
    listAvailabilityCacheRef.current = null;

    setPhotographers([]);
    setBackendSlots([]);
    setAllBackendSlots([]);
    setLoading(false);
    setLoadingPhotographers(true);
    setSelectedPhotographer(isPhotographer && userId ? String(userId) : "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilitySessionScope, isPhotographer, userId]);

  const invalidatePhotographerBookedCache = useCallback((photographerId: string | number) => {
    const prefix = `${photographerId}|`;
    bookedSlotsCacheRef.current.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        bookedSlotsCacheRef.current.delete(key);
      }
    });
  }, []);

  const refreshPhotographerSlots = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      if (!selectedPhotographer) {
        setBackendSlots([]);
        setAllBackendSlots([]);
        return;
      }

      const anchorDate = date || new Date();
      const weekStart = startOfWeek(anchorDate);
      const weekEnd = addDays(weekStart, 6);
      const monthStart = startOfMonth(anchorDate);
      const monthEnd = endOfMonth(anchorDate);

      const fromDate = viewMode === 'day'
        ? format(anchorDate, 'yyyy-MM-dd')
        : viewMode === 'week'
        ? format(weekStart, 'yyyy-MM-dd')
        : format(monthStart, 'yyyy-MM-dd');

      const toDate = viewMode === 'day'
        ? format(anchorDate, 'yyyy-MM-dd')
        : viewMode === 'week'
        ? format(weekEnd, 'yyyy-MM-dd')
        : format(monthEnd, 'yyyy-MM-dd');

      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (selectedPhotographer === 'all') {
        if (!photographers || photographers.length === 0) {
          setAllBackendSlots([]);
          setBackendSlots([]);
          return;
        }

        let usedBulkEndpoint = false;
        const CACHE_TTL = 60 * 1000;
        const cacheKey = `all_${fromDate}_${toDate}`;

        const cached = bulkAvailabilityCacheRef.current;
        if (cached && cached.key === cacheKey && (Date.now() - cached.timestamp) < CACHE_TTL) {
          setAllBackendSlots(cached.data);
          setBackendSlots([]);
          return;
        }

        try {
          const photographerIds = photographers.map(p => Number(p.id));
          const bulkResponse = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
            method: 'POST',
            headers,
            signal,
            body: JSON.stringify({
              photographer_ids: photographerIds,
              from_date: fromDate,
              to_date: toDate,
            }),
          });

          if (signal?.aborted) return;

          if (bulkResponse.ok) {
            const bulkJson = await bulkResponse.json();
            const groupedData = bulkJson?.data || {};

            const allSlots: BackendSlot[] = [];
            for (const [photographerId, slots] of Object.entries(groupedData)) {
              const mappedSlots = mapBackendSlots(slots as readonly unknown[], photographerId);
              allSlots.push(...mappedSlots);
            }

            bulkAvailabilityCacheRef.current = { key: cacheKey, data: allSlots, timestamp: Date.now() };

            if (!signal?.aborted) {
              setAllBackendSlots(allSlots);
              setBackendSlots([]);
            }
            usedBulkEndpoint = true;
          }
        } catch (bulkError: unknown) {
          if (isAbortError(bulkError)) return;
          console.warn('Bulk endpoint failed, falling back to individual calls:', bulkError);
        }

        if (!usedBulkEndpoint && !signal?.aborted) {
          const batchSize = 10;
          const results: Array<{ id: string; slots: BackendSlot[] }> = [];

          for (let i = 0; i < photographers.length; i += batchSize) {
            if (signal?.aborted) return;
            const batch = photographers.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map(async (p) => {
                try {
                  const response = await fetch(API_ROUTES.photographerAvailability.list(p.id), { signal });
                  if (!response.ok) throw new Error('Failed to load availability');
                  const json = await response.json();
                  return { id: p.id, slots: mapBackendSlots((json?.data || []) as readonly unknown[], p.id) };
                } catch {
                  return { id: p.id, slots: [] as BackendSlot[] };
                }
              })
            );
            results.push(...batchResults);
          }

          if (!signal?.aborted) {
            setAllBackendSlots(results.flatMap(({ slots }) => slots));
            setBackendSlots([]);
          }
        }

        return;
      }

      const [availabilityResponse, bookedResponse] = await Promise.all([
        fetch(API_ROUTES.photographerAvailability.list(selectedPhotographer), { signal }),
        fetch(API_ROUTES.photographerAvailability.bookedSlots, {
          method: 'POST',
          headers,
          signal,
          body: JSON.stringify({
            photographer_id: Number(selectedPhotographer),
            from_date: fromDate,
            to_date: toDate,
          }),
        }).catch(() => null),
      ]);

      if (signal?.aborted) return;

      if (!availabilityResponse.ok) {
        throw new Error('Failed to load availability');
      }

      const availabilityJson = await availabilityResponse.json();
      const availabilitySlots = mapBackendSlots((availabilityJson?.data || []) as readonly unknown[], selectedPhotographer);

      let bookedSlots: BackendSlot[] = [];
      if (bookedResponse && bookedResponse.ok) {
        const bookedJson = await bookedResponse.json();
        const rawBooked = Array.isArray(bookedJson?.data) ? (bookedJson.data as unknown[]) : [];
        bookedSlots = rawBooked.map((raw) => {
          const row = (raw ?? {}) as Record<string, unknown>;
          const shootId = readNumber(row.shoot_id);
          return {
            ...(row as Partial<BackendSlot>),
            id: (row.id as number | string | undefined) || `shoot_${shootId ?? ''}`,
            photographer_id: Number(selectedPhotographer),
            start_time: readString(row.start_time) ?? "",
            end_time: readString(row.end_time) ?? "",
          } as BackendSlot;
        });
      }

      if (signal?.aborted) return;

      setBackendSlots([...availabilitySlots, ...bookedSlots]);
      setAllBackendSlots([]);
    } catch (error: unknown) {
      if (isAbortError(error)) return;
      console.error('Error refreshing photographer slots:', error);
      if (signal?.aborted) return;
      if (selectedPhotographer === 'all') {
        setAllBackendSlots([]);
        setBackendSlots([]);
      } else {
        setBackendSlots([]);
        setAllBackendSlots([]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPhotographer, photographers, date, viewMode]);

  // Listen for availability updates from other components.
  // refreshPhotographerSlots is intentionally excluded: its identity changes on
  // every `photographers`/`date`/`viewMode` update, which would remount the
  // listener each time. Using the latest closure via selectedPhotographer dep
  // is sufficient for correctness because the event only needs to fire a
  // refresh, not capture fresh deps.
  useEffect(() => {
    const handleAvailabilityUpdate = (event: CustomEvent) => {
      const { photographerId } = event.detail || {};
      if (photographerId) {
        invalidatePhotographerBookedCache(photographerId);
      }
      if (selectedPhotographer === photographerId || selectedPhotographer === 'all') {
        refreshPhotographerSlots();
      }
    };

    window.addEventListener('availability-updated', handleAvailabilityUpdate as EventListener);
    return () => {
      window.removeEventListener('availability-updated', handleAvailabilityUpdate as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhotographer, invalidatePhotographerBookedCache]);

  // Load photographers with client-side caching
  useEffect(() => {
    const cachedPhotographers = sessionStorage.getItem(photographersCacheKey);
    const cacheTimestamp = sessionStorage.getItem(photographersCacheTimeKey);
    const CACHE_TTL = 5 * 60 * 1000;

    if (cachedPhotographers && cacheTimestamp) {
      const cacheAge = Date.now() - parseInt(cacheTimestamp, 10);
      if (cacheAge < CACHE_TTL) {
        try {
          const list = JSON.parse(cachedPhotographers);
          if (Array.isArray(list) && list.length > 0) {
            setPhotographers(list);
            setLoadingPhotographers(false);
            return;
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
    }

    const loadPhotographers = async () => {
      setLoadingPhotographers(true);
      try {
        const apiRoutesExt = API_ROUTES as ApiRoutesWithPeople;
        const publicUrl = apiRoutesExt.people?.photographers || `${API_BASE_URL}/api/photographers`;
        const token = localStorage.getItem("authToken") || localStorage.getItem("token");

        const mapUser = (raw: unknown): Photographer => {
          const u = (raw ?? {}) as Record<string, unknown>;
          const id = u.id;
          const idStr = id === undefined || id === null ? "" : String(id);
          const name =
            readString(u.name) ||
            readString(u.full_name) ||
            readString(u.email) ||
            `User ${idStr}`;
          const avatar = readString(u.avatar) || readString(u.profile_photo_url);
          return { id: idStr, name, avatar };
        };

        const extractUsers = (json: unknown): unknown[] => {
          if (Array.isArray(json)) return json;
          const obj = (json ?? {}) as Record<string, unknown>;
          if (Array.isArray(obj.data)) return obj.data as unknown[];
          if (Array.isArray(obj.users)) return obj.users as unknown[];
          return [];
        };

        let list: Photographer[] = [];
        try {
          const r = await fetch(publicUrl);
          if (r.ok) {
            const json = await r.json();
            list = extractUsers(json).map(mapUser);
          }
        } catch {
          // Public endpoint failed
        }

        if (list.length === 0 && token) {
          try {
            const adminUrl = apiRoutesExt.people?.adminPhotographers || `${API_BASE_URL}/api/admin/photographers`;
            const r = await fetch(adminUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) {
              const json = await r.json();
              list = extractUsers(json).map(mapUser);
            }
          } catch {
            // Admin endpoint also failed
          }
        }

        setPhotographers(list);
        if (list.length > 0) {
          sessionStorage.setItem(photographersCacheKey, JSON.stringify(list));
          sessionStorage.setItem(photographersCacheTimeKey, String(Date.now()));
        }
      } catch {
        setPhotographers([]);
      } finally {
        setLoadingPhotographers(false);
      }
    };

    loadPhotographers();
  }, [photographersCacheKey, photographersCacheTimeKey]);

  // Auto-select the logged-in photographer as the default scope.
  // setSelectedPhotographer is stable from the parent; omitted intentionally.
  useEffect(() => {
    if (isPhotographer && userId && selectedPhotographer === "all") {
      setSelectedPhotographer(String(userId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhotographer, userId, selectedPhotographer]);

  // Load slots when photographer/date/view change; abort stale requests.
  // refreshPhotographerSlots is intentionally omitted: its identity changes
  // whenever `photographers` loads, but `loadingPhotographers` IS in deps and
  // flips to false right after, which re-runs this effect with the fresh
  // closure. Adding it directly would cause duplicate fetches per render.
  useEffect(() => {
    if (!selectedPhotographer || loadingPhotographers) return;

    const abortController = new AbortController();
    refreshPhotographerSlots(abortController.signal);

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhotographer, date, viewMode, loadingPhotographers]);

  // Keep list availability updated for team management view when a single photographer is selected
  useEffect(() => {
    if (!canManagePhotographerSelection || loadingPhotographers || selectedPhotographer === "all") return;
    if (!date || photographers.length === 0) return;

    const anchorDate = date || new Date();
    const weekStart = startOfWeek(anchorDate);
    const weekEnd = addDays(weekStart, 6);
    const monthStart = startOfMonth(anchorDate);
    const monthEnd = endOfMonth(anchorDate);

    const fromDate = viewMode === "day"
      ? format(anchorDate, "yyyy-MM-dd")
      : viewMode === "week"
        ? format(weekStart, "yyyy-MM-dd")
        : format(monthStart, "yyyy-MM-dd");

    const toDate = viewMode === "day"
      ? format(anchorDate, "yyyy-MM-dd")
      : viewMode === "week"
        ? format(weekEnd, "yyyy-MM-dd")
        : format(monthEnd, "yyyy-MM-dd");

    const cacheKey = `list_${fromDate}_${toDate}`;
    const CACHE_TTL = 60 * 1000;
    const cached = listAvailabilityCacheRef.current;
    if (cached && cached.key === cacheKey && (Date.now() - cached.timestamp) < CACHE_TTL) {
      const map: Record<string, BackendSlot[]> = {};
      cached.data.forEach((slot) => {
        const pid = String(slot.photographer_id);
        if (!map[pid]) map[pid] = [];
        map[pid].push(slot);
      });
      setPhotographerAvailabilityMap(map);
      return;
    }

    let cancelled = false;
    const loadListAvailability = async () => {
      try {
        const photographerIds = photographers.map((p) => Number(p.id));
        const response = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            photographer_ids: photographerIds,
            from_date: fromDate,
            to_date: toDate,
          }),
        });

        if (!response.ok) return;

        const bulkJson = await response.json();
        const groupedData = bulkJson?.data || {};
        const map: Record<string, BackendSlot[]> = {};
        const allSlots: BackendSlot[] = [];

        for (const [photographerId, slots] of Object.entries(groupedData)) {
          const mappedSlots = mapBackendSlots(slots as readonly unknown[], photographerId);
          map[String(photographerId)] = mappedSlots;
          allSlots.push(...mappedSlots);
        }

        if (!cancelled) {
          listAvailabilityCacheRef.current = { key: cacheKey, data: allSlots, timestamp: Date.now() };
          setPhotographerAvailabilityMap(map);
        }
      } catch {
        // ignore
      }
    };

    loadListAvailability();
    return () => {
      cancelled = true;
    };
  }, [canManagePhotographerSelection, selectedPhotographer, date, viewMode, photographers, loadingPhotographers, authHeaders]);

  // Populate photographerAvailabilityMap from allBackendSlots when it changes
  useEffect(() => {
    if (allBackendSlots.length > 0) {
      const map: Record<string, BackendSlot[]> = {};
      allBackendSlots.forEach(slot => {
        const pid = String(slot.photographer_id);
        if (!map[pid]) map[pid] = [];
        map[pid].push(slot);
      });
      setPhotographerAvailabilityMap(map);
    }
  }, [allBackendSlots]);

  return {
    photographers,
    loadingPhotographers,
    backendSlots,
    allBackendSlots,
    loading,
    photographerAvailabilityMap,
    authHeaders,
    refreshPhotographerSlots,
    invalidatePhotographerBookedCache,
  };
}
