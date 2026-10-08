import type { OperationalFiltersState } from '@/components/shoots/history/shootHistoryUtils'

/** Use identical person filters for listings, reports and exports. */
export function shootHistoryPersonParams(
  filters: Pick<OperationalFiltersState, 'clientId' | 'photographerId' | 'salesRepId' | 'paymentStatus'>,
  hideClient: boolean,
) {
  return {
    ...(!hideClient && filters.clientId ? { client_id: filters.clientId } : {}),
    ...(filters.photographerId ? { photographer_id: filters.photographerId } : {}),
    ...(filters.paymentStatus && filters.paymentStatus !== 'all' ? { payment_status: filters.paymentStatus } : {}),
    ...(filters.salesRepId ? { sales_rep_id: filters.salesRepId } : {}),
  }
}
