import { useMemo } from 'react'
import { AutoExpandingTab } from '@/components/ui/auto-expanding-tabs'
import {
  ActiveOperationalTab,
  STATUS_FILTERS_BY_TAB,
  isEditorActiveOperationalShoot,
  isEditorDeliveredOperationalShoot,
} from '@/components/shoots/history/shootHistoryUtils'
import { ShootData } from '@/types/shoots'
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Image,
  Loader2,
  PauseCircle,
} from 'lucide-react'

type UseShootHistoryViewStateArgs = {
  role: string | null | undefined
  isEditor: boolean
  canViewHistory: boolean
  operationalData: ShootData[]
  historyMeta: { total?: number } | null
  operationalServicesSelected: boolean
  historyServicesSelected: boolean
}

export function useShootHistoryViewState({
  role,
  isEditor,
  canViewHistory,
  operationalData,
  historyMeta,
  operationalServicesSelected,
  historyServicesSelected,
}: UseShootHistoryViewStateArgs) {
  const tabsConfig: AutoExpandingTab[] = useMemo(() => {
    const statusKey = (shoot: ShootData) => (shoot.workflowStatus || shoot.status || '').toLowerCase()
    const matchesTab = (shoot: ShootData, tab: ActiveOperationalTab) =>
      (STATUS_FILTERS_BY_TAB[tab] ?? []).some((allowed) => statusKey(shoot).includes(allowed))

    const scheduledCount = operationalData.filter((shoot) => matchesTab(shoot, 'scheduled')).length
    const completedCount = operationalData.filter((shoot) => matchesTab(shoot, 'completed')).length
    const deliveredCount = operationalData.filter((shoot) => matchesTab(shoot, 'delivered')).length
    const holdCount = operationalData.filter((shoot) => matchesTab(shoot, 'hold')).length
    const editingCount = operationalData.filter((shoot) => isEditorActiveOperationalShoot(shoot)).length
    const editedCount = operationalData.filter((shoot) => isEditorDeliveredOperationalShoot(shoot)).length

    if (isEditor) {
      const editorTabs: AutoExpandingTab[] = [
        {
          value: 'editing',
          icon: Image,
          label: 'Editing',
          badge: editingCount > 0 ? editingCount : undefined,
        },
        {
          value: 'edited',
          icon: CheckCircle2,
          label: 'Edited',
          badge: editedCount > 0 ? editedCount : undefined,
        },
      ]

      if (canViewHistory) {
        editorTabs.push({
          value: 'history',
          icon: Clock,
          label: 'History',
          badge: historyMeta?.total ? historyMeta.total : undefined,
        })
      }

      return editorTabs
    }

    const canViewInProgress = !['client', 'editor'].includes(role || '')

    const baseTabs: AutoExpandingTab[] = [
      {
        value: 'scheduled',
        icon: CalendarIcon,
        label: 'Scheduled',
        badge: scheduledCount > 0 ? scheduledCount : undefined,
      },
      ...(canViewInProgress
        ? [
            {
              value: 'completed' as const,
              icon: Loader2,
              label: 'In-Progress',
              badge: completedCount > 0 ? completedCount : undefined,
            },
          ]
        : []),
      {
        value: 'delivered',
        icon: CheckCircle2,
        label: 'Delivered',
        badge: deliveredCount > 0 ? deliveredCount : undefined,
      },
      {
        value: 'hold',
        icon: PauseCircle,
        label: 'On-Hold',
        badge: holdCount > 0 ? holdCount : undefined,
      },
    ]

    if (canViewHistory) {
      baseTabs.push({
        value: 'history',
        icon: Clock,
        label: 'History',
        badge: historyMeta?.total ? historyMeta.total : undefined,
      })
    }

    return baseTabs
  }, [canViewHistory, historyMeta?.total, isEditor, operationalData, role])

  return {
    operationalServicesSelected,
    historyServicesSelected,
    tabsConfig,
  }
}
