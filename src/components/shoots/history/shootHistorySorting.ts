import type { AvailableTab } from './shootHistoryUtils'

export type ShootHistorySort = 'today_upcoming' | 'next_up' | 'date_asc' | 'date_desc'

export const SHOOT_HISTORY_SORT_STORAGE_KEY = 'shootHistory_sortByTab'

const BE_SUPPORTED_SORTS: ReadonlySet<ShootHistorySort> = new Set([
  'next_up',
  'date_asc',
  'date_desc',
])

export const SHOOT_HISTORY_SORT_OPTIONS: ReadonlyArray<{ value: ShootHistorySort; label: string }> = [
  { value: 'next_up', label: 'Next upcoming' },
  { value: 'date_asc', label: 'Date: earliest first' },
  { value: 'date_desc', label: 'Date: latest first' },
]

export const getDefaultShootHistorySort = (tab: AvailableTab): ShootHistorySort =>
  tab === 'scheduled' ? 'next_up' : 'date_desc'

export const getShootHistorySortOptions = (
  tab: AvailableTab,
): ReadonlyArray<{ value: ShootHistorySort; label: string }> =>
  tab === 'scheduled'
    ? SHOOT_HISTORY_SORT_OPTIONS
    : SHOOT_HISTORY_SORT_OPTIONS.filter((option) => option.value !== 'next_up')

export const isShootHistorySort = (value: unknown): value is ShootHistorySort =>
  typeof value === 'string' && BE_SUPPORTED_SORTS.has(value as ShootHistorySort)

export const parseStoredShootHistorySortByTab = (
  raw: string | null,
): Partial<Record<AvailableTab, ShootHistorySort>> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result: Partial<Record<AvailableTab, ShootHistorySort>> = {}
    for (const [tab, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isShootHistorySort(value)) {
        result[tab as AvailableTab] = value
      }
    }
    return result
  } catch {
    return {}
  }
}
