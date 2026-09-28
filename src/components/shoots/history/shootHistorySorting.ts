import type { AvailableTab } from './shootHistoryUtils'

export type ShootHistorySort = 'today_upcoming' | 'next_up' | 'date_asc' | 'date_desc'

export const SHOOT_HISTORY_SORT_OPTIONS: ReadonlyArray<{ value: ShootHistorySort; label: string }> = [
  { value: 'today_upcoming', label: 'Today & upcoming' },
  { value: 'next_up', label: 'Next upcoming' },
  { value: 'date_asc', label: 'Date: earliest first' },
  { value: 'date_desc', label: 'Date: latest first' },
]

export const getDefaultShootHistorySort = (tab: AvailableTab): ShootHistorySort =>
  tab === 'scheduled' ? 'today_upcoming' : 'date_desc'
