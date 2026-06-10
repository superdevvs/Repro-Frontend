import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/services/api';
import type { ScanStatus } from '@/hooks/useShootFiles';

export interface RescanResponse {
  message?: string;
  scan_status: ScanStatus;
}

export interface RescanInput {
  shootId: string | number;
  fileId: string | number;
}

/**
 * Rescan-file mutation (Req 15.8).
 *
 * Wraps `POST /api/shoots/{shoot}/files/{file}/rescan`. The backend resets a
 * `failed` file to `quarantined` and re-enqueues the {@code ScanShootFileJob}
 * — the response shape is `{ scan_status: 'quarantined' }`. Files in any
 * other state (already `clean`, `infected`, or still `quarantined`) are
 * rejected with HTTP 409 so a terminal verdict is never silently overwritten
 * (Req 15.4 / 15.8). Callers should disable the retry control while the
 * mutation is in flight.
 *
 * On success the matching `shootFiles` query keys are invalidated so the
 * file list refreshes with the new `quarantined` status (which the badge
 * renders as "Scanning").
 */
export function useRescanFile() {
  const queryClient = useQueryClient();

  return useMutation<RescanResponse, AxiosError<{ message?: string; scan_status?: ScanStatus }>, RescanInput>({
    mutationFn: async ({ shootId, fileId }) => {
      const response = await apiClient.post<RescanResponse>(
        `/shoots/${shootId}/files/${fileId}/rescan`,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      // Refresh both the per-type and combined views so the badge reflects
      // the new `quarantined` state immediately. Mirrors the invalidation
      // pattern used elsewhere in `useShootMediaActions` after file edits.
      queryClient.invalidateQueries({ queryKey: ['shootFiles', variables.shootId, 'raw'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', variables.shootId, 'edited'] });
      queryClient.invalidateQueries({ queryKey: ['shootFiles', variables.shootId, 'all'] });
    },
  });
}
