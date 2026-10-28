import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/services/api'
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms'
import type { ShootData } from '@/types/shoots'
import type { DashboardShootSummary } from '@/types/dashboard'
import {
  isEditorActiveOperationalShoot,
  filterEditorDeliveredOperationalShoots,
  getOperationalStatusKey,
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

const DEDICATED_EDITOR_QUEUE_PER_PAGE = 50
const DELIVERED_EDITOR_LANE_STATUSES = new Set([
  'delivered', 'ready_for_client', 'admin_verified', 'client_delivered',
  'workflow_completed', 'delivered_to_client', 'finalized',
])

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
        include_filters: 'false',
        view: 'card',
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
  const completed = useQuery({
    queryKey: ['editor-dashboard-queue', editorId ?? null, 'completed'],
    enabled: enabled && Boolean(editorId),
    queryFn: ({ signal }) => fetchEditorDashboardShoots('completed', signal),
    staleTime: 0, refetchOnWindowFocus: true,
  })
  const delivered = useQuery({
    queryKey: ['editor-dashboard-queue', editorId ?? null, 'delivered'],
    enabled: enabled && Boolean(editorId),
    queryFn: ({ signal }) => fetchEditorDashboardShoots('delivered', signal),
    staleTime: 0, refetchOnWindowFocus: true,
  })
  const refetchCompleted = completed.refetch
  const refetchDelivered = delivered.refetch
  const refetch = useCallback(() => Promise.all([refetchCompleted(), refetchDelivered()]), [refetchCompleted, refetchDelivered])
  const data = useMemo((): EditorDashboardQueueData => {
      const completedShoots = completed.data ?? []
      const deliveredShoots = delivered.data ?? []
      const hasPendingEditorWork = (shoot: ShootData) => shoot.editorAssignments?.some(
        assignment => String(assignment.editorId ?? assignment.editor?.id) === String(editorId) && assignment.ready === false,
      ) ?? false
      const hasPendingDeliveredEditorWork = (shoot: ShootData) =>
        DELIVERED_EDITOR_LANE_STATUSES.has(getOperationalStatusKey(shoot)) && hasPendingEditorWork(shoot)
      const upcomingShoots = dedupeShoots(completedShoots.filter(
        shoot => isEditorActiveOperationalShoot(shoot) || hasPendingDeliveredEditorWork(shoot),
      ))
      const upcomingIds = new Set(upcomingShoots.map(shoot => String(shoot.id)))
      const resolvedDeliveredShoots = dedupeShoots(
        filterEditorDeliveredOperationalShoots(deliveredShoots).filter(shoot => !upcomingIds.has(String(shoot.id)) && !hasPendingDeliveredEditorWork(shoot)),
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
  }, [completed.data, delivered.data, editorId])

  return {
    ...data,
    isLoading: completed.isLoading || delivered.isLoading,
    isDeliveredLoading: delivered.isLoading,
    isFetching: completed.isFetching || delivered.isFetching,
    isError: completed.isError || delivered.isError,
    error: completed.error ?? delivered.error,
    refetch,
  }
}
