import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms'
import type { ShootData } from '@/types/shoots'
import type { DashboardShootSummary } from '@/types/dashboard'
import {
  isEditorActiveOperationalShoot,
  filterEditorDeliveredOperationalShoots,
} from '@/components/shoots/history/shootHistoryUtils'
import { shootDataToSummary } from '@/utils/dashboardDerivedUtils'
import { readShootListPages } from '@/utils/readShootListPages'

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

const fetchEditorDashboardShoots = async (tab: 'completed' | 'delivered', signal?: AbortSignal) => {
  const readPage = async (page: number) => {
    const response = await apiClient.get('/shoots', {
      signal,
      params: {
        tab,
        page,
        per_page: DEDICATED_EDITOR_QUEUE_PER_PAGE,
        include_files: 'false',
        no_cache: 'true',
        ...(tab === 'completed' ? { dashboard_open: true } : {}),
      },
    })
    const payload = response.data?.data ?? response.data
    return {
      data: (Array.isArray(payload) ? payload : []) as Record<string, unknown>[],
      meta: response.data?.meta as { last_page?: number } | undefined,
    }
  }
  const first = await readPage(1)
  const payload = tab === 'completed'
    ? await readShootListPages(first, readPage, { signal })
    : first
  const records = payload.data ?? []

  return records.map((item) => mapShootApiToShootData(item as Record<string, unknown>))
}

export const useEditorDashboardQueue = (
  editorId: number | string | null | undefined,
  enabled: boolean,
) => {
  const query = useQuery({
    queryKey: ['editor-dashboard-queue', editorId ?? null],
    enabled: enabled && Boolean(editorId),
    queryFn: async ({ signal }): Promise<EditorDashboardQueueData> => {
      const [completedShoots, deliveredShoots] = await Promise.all([
        fetchEditorDashboardShoots('completed', signal),
        fetchEditorDashboardShoots('delivered', signal),
      ])

      const hasPendingEditorWork = (shoot: ShootData) => shoot.editorAssignments?.some(
        assignment => String(assignment.editorId ?? assignment.editor?.id) === String(editorId) && assignment.ready === false,
      ) ?? false
      const upcomingShoots = dedupeShoots(completedShoots.filter(
        shoot => isEditorActiveOperationalShoot(shoot) || hasPendingEditorWork(shoot),
      ))
      const upcomingIds = new Set(upcomingShoots.map(shoot => String(shoot.id)))
      const resolvedDeliveredShoots = dedupeShoots(
        filterEditorDeliveredOperationalShoots(deliveredShoots).filter(shoot => !upcomingIds.has(String(shoot.id)) && !hasPendingEditorWork(shoot)),
      )
      const sourceShoots = dedupeShoots([...upcomingShoots, ...resolvedDeliveredShoots])

      return {
        sourceShoots,
        upcomingShoots,
        deliveredShoots: resolvedDeliveredShoots,
        upcomingSummaries: upcomingShoots.map((shoot) => ({
          ...shootDataToSummary(shoot), hasPendingEditorWork: hasPendingEditorWork(shoot),
        })),
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
