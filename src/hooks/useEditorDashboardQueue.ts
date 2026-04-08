import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms'
import type { ShootData } from '@/types/shoots'
import type { DashboardShootSummary } from '@/types/dashboard'
import {
  filterEditorActiveOperationalShoots,
  filterEditorDeliveredOperationalShoots,
} from '@/components/shoots/history/shootHistoryUtils'
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils'

type EditorDashboardQueueData = {
  sourceShoots: ShootData[]
  upcomingShoots: ShootData[]
  deliveredShoots: ShootData[]
  upcomingSummaries: DashboardShootSummary[]
  deliveredSummaries: DashboardShootSummary[]
}

const DEDICATED_EDITOR_QUEUE_PER_PAGE = 200

const dedupeShoots = (shoots: ShootData[]) =>
  Array.from(new Map(shoots.map((shoot) => [String(shoot.id), shoot])).values())

const fetchEditorDashboardShoots = async (tab: 'completed' | 'delivered') => {
  const response = await apiClient.get('/shoots', {
    params: {
      tab,
      page: 1,
      per_page: DEDICATED_EDITOR_QUEUE_PER_PAGE,
      include_files: 'true',
      no_cache: 'true',
    },
  })

  const payload = response.data?.data ?? response.data
  const records = Array.isArray(payload) ? payload : []

  return records.map((item) => mapShootApiToShootData(item as Record<string, unknown>))
}

export const useEditorDashboardQueue = (
  editorId: number | string | null | undefined,
  enabled: boolean,
) => {
  const query = useQuery({
    queryKey: ['editor-dashboard-queue', editorId ?? null],
    enabled: enabled && Boolean(editorId),
    queryFn: async (): Promise<EditorDashboardQueueData> => {
      const [completedShoots, deliveredShoots] = await Promise.all([
        fetchEditorDashboardShoots('completed'),
        fetchEditorDashboardShoots('delivered'),
      ])

      const upcomingShoots = dedupeShoots(filterEditorActiveOperationalShoots(completedShoots))
      const resolvedDeliveredShoots = dedupeShoots(
        filterEditorDeliveredOperationalShoots(deliveredShoots),
      )
      const sourceShoots = dedupeShoots([...upcomingShoots, ...resolvedDeliveredShoots])

      return {
        sourceShoots,
        upcomingShoots,
        deliveredShoots: resolvedDeliveredShoots,
        upcomingSummaries: upcomingShoots.map((shoot) => shootDataToSummary(shoot)),
        deliveredSummaries: resolvedDeliveredShoots.map((shoot) => shootDataToSummary(shoot)),
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  return useMemo(
    () => ({
      sourceShoots: query.data?.sourceShoots ?? [],
      upcomingShoots: query.data?.upcomingShoots ?? [],
      deliveredShoots: query.data?.deliveredShoots ?? [],
      upcomingSummaries: query.data?.upcomingSummaries ?? [],
      deliveredSummaries: query.data?.deliveredSummaries ?? [],
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    }),
    [query.data, query.error, query.isError, query.isFetching, query.isLoading, query.refetch],
  )
}
