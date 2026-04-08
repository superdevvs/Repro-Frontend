import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import type { Service } from '@/hooks/useServices';
import {
  fetchEditorRates,
  updateEditorRates,
} from '@/services/editorRatesService';
import {
  getEditorRatesData,
  getEditorServiceRates,
  type EditorRatesData,
  type EditorServiceRate,
} from '@/utils/editorRates';

export const getEditorRatesQueryKey = (editorId?: string | null) => [
  'editor-rates',
  editorId ? String(editorId) : 'unknown',
] as const;

interface UseEditorRatesOptions {
  enabled?: boolean;
  services?: Service[];
}

const mergeEditorRatesIntoMetadata = (
  metadata: Record<string, unknown> | undefined,
  rates: EditorRatesData,
) => ({
  ...(metadata ?? {}),
  photo_edit_rate: rates.photo_edit_rate,
  video_edit_rate: rates.video_edit_rate,
  floorplan_rate: rates.floorplan_rate,
  virtual_staging_rate: rates.virtual_staging_rate,
  other_rate: rates.other_rate,
  service_rates: rates.service_rates.map((rate) => ({
    service_id: rate.serviceId ?? null,
    service_name: rate.serviceName,
    rate: rate.rate,
  })),
});

export const useEditorRates = (
  editorId?: string | null,
  { enabled = true, services = [] }: UseEditorRatesOptions = {},
) => {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const normalizedEditorId = editorId ? String(editorId) : null;
  const isCurrentUser = normalizedEditorId !== null && String(user?.id ?? '') === normalizedEditorId;

  const initialData = useMemo(() => {
    if (!isCurrentUser) {
      return undefined;
    }

    return getEditorRatesData(user?.metadata ?? {});
  }, [isCurrentUser, user?.metadata]);

  const query = useQuery({
    queryKey: getEditorRatesQueryKey(normalizedEditorId),
    enabled: enabled && Boolean(normalizedEditorId),
    initialData,
    queryFn: async () => fetchEditorRates(normalizedEditorId!),
  });

  const rates = useMemo(
    () => getEditorServiceRates(query.data ?? {}, services),
    [query.data, services],
  );

  const saveMutation = useMutation({
    mutationFn: async (nextRates: EditorServiceRate[]) =>
      updateEditorRates(normalizedEditorId!, nextRates),
    onSuccess: (nextData) => {
      queryClient.setQueryData(getEditorRatesQueryKey(normalizedEditorId), nextData);

      if (isCurrentUser && user) {
        setUser({
          ...user,
          metadata: mergeEditorRatesIntoMetadata(user.metadata, nextData),
        });
      }
    },
  });

  return {
    data: query.data ?? initialData ?? getEditorRatesData({}),
    rates,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isSaving: saveMutation.isPending,
    saveRates: saveMutation.mutateAsync,
  };
};
