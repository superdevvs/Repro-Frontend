import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import API_ROUTES from "@/lib/api";
import { API_BASE_URL } from "@/config/env";
import { getAuthToken } from "@/utils/authToken";
import type { BackendSlot, Photographer } from "@/types/availability";
import { mapBackendSlots, mergeBookedSlots } from "@/lib/availability/utils";
import {
  resolveSelectedPhotographer,
  scopePhotographersForViewer,
} from "@/lib/availability/photographerScope";

interface UseAvailabilityDataOptions {
  selectedPhotographer: string;
  setSelectedPhotographer: (value: string) => void;
  date: Date | undefined;
  viewMode: "day" | "week" | "month";
  role: string | null | undefined;
  userId: number | string | undefined;
  viewerName?: string | null;
  isPhotographer: boolean;
  canManagePhotographerSelection: boolean;
  availabilitySessionScope: string;
  loadingPhotographers?: boolean;
}
type SlotState = {
  key: string;
  rows: BackendSlot[];
  error?: string;
  loading: boolean;
};
const EMPTY_ROWS: BackendSlot[] = [];
const EMPTY_PEOPLE: Photographer[] = [];
const extractUsers = (json: unknown): Record<string, unknown>[] => {
  const object = json as { data?: unknown; users?: unknown } | null;
  const list = Array.isArray(json) ? json : (object?.data ?? object?.users);
  return Array.isArray(list) ? list : [];
};

export function useAvailabilityData({
  selectedPhotographer,
  setSelectedPhotographer,
  date,
  viewMode,
  userId,
  viewerName,
  isPhotographer,
  availabilitySessionScope,
}: UseAvailabilityDataOptions) {
  const [roster, setRoster] = useState<{
    scope: string;
    people: Photographer[];
    error?: string;
  }>({ scope: "", people: [] });
  const [slotState, setSlotState] = useState<SlotState>({
    key: "",
    rows: [],
    loading: false,
  });
  const [retry, setRetry] = useState(0);
  const slotRequest = useRef<AbortController | null>(null);
  const authHeaders = useCallback((): Record<string, string> => {
    const token = getAuthToken();
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);
  const photographers =
    roster.scope === availabilitySessionScope ? roster.people : EMPTY_PEOPLE;
  const loadingPhotographers = roster.scope !== availabilitySessionScope;
  const anchor = date ?? new Date();
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const from = format(
    viewMode === "month"
      ? startOfMonth(anchor)
      : viewMode === "week"
        ? weekStart
        : anchor,
    "yyyy-MM-dd",
  );
  const to = format(
    viewMode === "month"
      ? endOfMonth(anchor)
      : viewMode === "week"
        ? addDays(weekStart, 6)
        : anchor,
    "yyyy-MM-dd",
  );
  const key = JSON.stringify([
    availabilitySessionScope,
    selectedPhotographer,
    from,
    to,
    photographers.map((p) => p.id),
  ]);
  const activeKey = useRef(key);
  activeKey.current = key;

  useEffect(() => {
    setSelectedPhotographer(
      resolveSelectedPhotographer("all", { isPhotographer, userId }),
    );
  }, [
    availabilitySessionScope,
    isPhotographer,
    userId,
    setSelectedPhotographer,
  ]);
  useEffect(() => {
    const selected = resolveSelectedPhotographer(selectedPhotographer, {
      isPhotographer,
      userId,
    });
    if (selected !== selectedPhotographer) setSelectedPhotographer(selected);
  }, [selectedPhotographer, isPhotographer, userId, setSelectedPhotographer]);

  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        let response = await fetch(`${API_BASE_URL}/api/photographers`, {
          headers: authHeaders(),
          signal: abort.signal,
        });
        if (!response.ok && !isPhotographer)
          response = await fetch(`${API_BASE_URL}/api/admin/photographers`, {
            headers: authHeaders(),
            signal: abort.signal,
          });
        if (!response.ok)
          throw new Error("Unable to load photographers. Please retry.");
        const people = extractUsers(await response.json()).map((row) => ({
          id: String(row.id),
          name: String(
            row.name ?? row.full_name ?? row.email ?? "Photographer",
          ),
          avatar:
            typeof row.avatar === "string"
              ? row.avatar
              : typeof row.profile_photo_url === "string"
                ? row.profile_photo_url
                : undefined,
        }));
        if (!abort.signal.aborted)
          setRoster({
            scope: availabilitySessionScope,
            people: scopePhotographersForViewer(people, {
              isPhotographer,
              userId,
              name: viewerName,
            }),
          });
      } catch (error) {
        if (!abort.signal.aborted)
          setRoster({
            scope: availabilitySessionScope,
            people: [],
            error:
              error instanceof Error
                ? error.message
                : "Unable to load photographers.",
          });
      }
    };
    void load();
    return () => abort.abort();
  }, [
    availabilitySessionScope,
    isPhotographer,
    userId,
    viewerName,
    authHeaders,
    retry,
  ]);

  const refreshPhotographerSlots = useCallback(
    async (signal?: AbortSignal) => {
      if (key !== activeKey.current) return;
      slotRequest.current?.abort();
      const abort = new AbortController();
      slotRequest.current = abort;
      const cancel = () => abort.abort();
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) abort.abort();
      setSlotState({ key, rows: [], loading: true });
      try {
        const headers = authHeaders();
        const readPerson = async (id: string) => {
          const [hours, bookings] = await Promise.all([
            fetch(API_ROUTES.photographerAvailability.list(id), {
              headers,
              signal: abort.signal,
            }),
            fetch(API_ROUTES.photographerAvailability.bookedSlots, {
              method: "POST",
              headers,
              signal: abort.signal,
              body: JSON.stringify({
                photographer_id: Number(id),
                from_date: from,
                to_date: to,
              }),
            }),
          ]);
          // Missing bookings must never be presented as free time.
          if (!hours.ok || !bookings.ok)
            throw new Error(
              "Unable to load the complete schedule. Please retry.",
            );
          const [hoursJson, bookingsJson] = await Promise.all([
            hours.json(),
            bookings.json(),
          ]);
          return mergeBookedSlots([
            ...mapBackendSlots(hoursJson.data, id),
            ...mapBackendSlots(bookingsJson.data, id),
          ]);
        };
        let rows: BackendSlot[] = [];
        if (
          selectedPhotographer === "all" &&
          !isPhotographer &&
          photographers.length
        ) {
          const response = await fetch(
            API_ROUTES.photographerAvailability.bulkIndex,
            {
              method: "POST",
              headers,
              signal: abort.signal,
              body: JSON.stringify({
                photographer_ids: photographers.map((p) => Number(p.id)),
                from_date: from,
                to_date: to,
              }),
            },
          );
          if (response.ok) {
            const json = await response.json();
            rows = photographers.flatMap((p) =>
              mapBackendSlots(json.data?.[p.id] ?? [], p.id),
            );
          } else {
            if ([401, 403].includes(response.status))
              throw new Error("You do not have access to these schedules.");
            // Older servers can fall back to individual reads, including booked visits.
            for (let index = 0; index < photographers.length; index += 6) {
              rows.push(
                ...(
                  await Promise.all(
                    photographers
                      .slice(index, index + 6)
                      .map((p) => readPerson(p.id)),
                  )
                ).flat(),
              );
            }
          }
        } else if (selectedPhotographer !== "all" && selectedPhotographer) {
          rows = await readPerson(selectedPhotographer);
        }
        if (!abort.signal.aborted)
          setSlotState({ key, rows: mergeBookedSlots(rows), loading: false });
      } catch (error) {
        if (!abort.signal.aborted)
          setSlotState({
            key,
            rows: [],
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load availability.",
          });
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
    },
    [
      key,
      from,
      to,
      selectedPhotographer,
      photographers,
      isPhotographer,
      authHeaders,
    ],
  );

  useEffect(() => {
    if (loadingPhotographers || roster.error) return;
    const abort = new AbortController();
    void refreshPhotographerSlots(abort.signal);
    return () => abort.abort();
  }, [loadingPhotographers, roster.error, refreshPhotographerSlots, retry]);
  useEffect(() => {
    const update = () => {
      void refreshPhotographerSlots();
    };
    window.addEventListener("availability-updated", update);
    return () => window.removeEventListener("availability-updated", update);
  }, [refreshPhotographerSlots]);

  const rows =
    slotState.key === key && !slotState.loading ? slotState.rows : EMPTY_ROWS;
  const photographerAvailabilityMap = useMemo(() => {
    const grouped: Record<string, BackendSlot[]> = {};
    for (const row of rows)
      (grouped[String(row.photographer_id)] ??= []).push(row);
    return grouped;
  }, [rows]);
  return {
    photographers,
    loadingPhotographers,
    loading:
      !roster.error &&
      (loadingPhotographers || slotState.key !== key || slotState.loading),
    error:
      roster.error ?? (slotState.key === key ? slotState.error : undefined),
    backendSlots: selectedPhotographer === "all" ? EMPTY_ROWS : rows,
    allBackendSlots: selectedPhotographer === "all" ? rows : EMPTY_ROWS,
    photographerAvailabilityMap,
    authHeaders,
    refreshPhotographerSlots,
    retry: () => setRetry((value) => value + 1),
  };
}
