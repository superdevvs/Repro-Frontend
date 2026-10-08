import type { OperationalFiltersState } from '@/components/shoots/history/shootHistoryUtils'

/** Use identical person filters for listings, reports and exports. */
export function shootHistoryPersonParams(
  filters: Pick<OperationalFiltersState, 'clientId' | 'photographerId' | 'salesRepId'>,
  hideClient: boolean,
) {
  return {
    ...(!hideClient && filters.clientId ? { client_id: filters.clientId } : {}),
    ...(filters.photographerId ? { photographer_id: filters.photographerId } : {}),
    ...(filters.salesRepId ? { sales_rep_id: filters.salesRepId } : {}),
  }
}
