import type { AvailableTab } from './shootHistoryUtils'

export type ShootHistorySort = 'next_up' | 'date_asc' | 'date_desc'

export const SHOOT_HISTORY_SORT_OPTIONS: ReadonlyArray<{ value: ShootHistorySort; label: string }> = [
  { value: 'next_up', label: 'Next upcoming' },
  { value: 'date_asc', label: 'Date: earliest first' },
  { value: 'date_desc', label: 'Date: latest first' },
]

export const getDefaultShootHistorySort = (tab: AvailableTab): ShootHistorySort =>
  tab === 'scheduled' ? 'next_up' : 'date_desc'
