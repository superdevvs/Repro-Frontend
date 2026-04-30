import { useEffect, useState } from "react";
import { format } from "date-fns";

import { fetchAvailablePhotographers } from "@/services/dashboardService";
import { getAuthToken } from "@/utils/authToken";

export const useAvailabilityWindow = (
  canLoadAvailability: boolean,
  accessToken?: string | null,
) => {
  const [availabilityWindow, setAvailabilityWindow] = useState(() => ({
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "17:00",
  }));
  const [availablePhotographerIds, setAvailablePhotographerIds] = useState<number[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!canLoadAvailability) return;
    const token = getAuthToken(accessToken);
    if (!token) {
      setAvailabilityError("Missing auth token");
      return;
    }
    setAvailabilityLoading(true);
    fetchAvailablePhotographers(availabilityWindow, token)
      .then((ids) => {
        setAvailablePhotographerIds(ids);
        setAvailabilityError(null);
      })
      .catch((err) => {
        setAvailabilityError(err instanceof Error ? err.message : "Unable to load availability");
      })
      .finally(() => setAvailabilityLoading(false));
  }, [availabilityWindow, canLoadAvailability, accessToken]);

  return {
    availabilityWindow,
    setAvailabilityWindow,
    availablePhotographerIds,
    availabilityError,
    availabilityLoading,
  };
};
