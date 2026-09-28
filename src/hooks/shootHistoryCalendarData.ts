import type { FilterCollections } from '@/components/shoots/history/shootHistoryUtils'
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms'
import type { ShootData, ShootHistoryRecord } from '@/types/shoots'
import { getShootSchedule } from '@/utils/shootSchedule'

export interface ShootCalendarRange { start: string; end: string }
export interface CalendarPage {
  data?: unknown
  meta?: { current_page?: number; per_page?: number; total?: number; count?: number; filters?: FilterCollections }
}

const incompleteMessage = 'The calendar could not load every shoot. Refresh to try again.'
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const checkCancelled = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException('Calendar load cancelled', 'AbortError')
}

/** Commit only a complete, consistent page set. A failed page must never look like an empty day. */
export async function fetchCalendarPages(
  fetchPage: (page: number) => Promise<CalendarPage>,
  signal: AbortSignal,
): Promise<{ rows: Record<string, unknown>[]; filters: FilterCollections }> {
  const rows: Record<string, unknown>[] = []
  const ids = new Set<string>()
  const clients = new Map<string, FilterCollections['clients'][number]>()
  const photographers = new Map<string, FilterCollections['photographers'][number]>()
  const services = new Set<string>()
  let total: number | undefined
  let perPage: number | undefined
  for (let page = 1; ; page += 1) {
    checkCancelled(signal)
    const response = await fetchPage(page)
    checkCancelled(signal)
    const meta = response.meta
    const count = meta?.total ?? meta?.count
    if (!Array.isArray(response.data) || !integer(count) || !integer(meta?.per_page) || !meta.per_page || meta.current_page !== page) {
      throw new Error(incompleteMessage)
    }
    if ((total !== undefined && total !== count) || (perPage !== undefined && perPage !== meta.per_page)) {
      throw new Error('The shoot schedule changed while loading. Refresh to load the current calendar.')
    }
    total = count
    perPage = meta.per_page
    if (response.data.length > perPage) throw new Error(incompleteMessage)
    for (const value of response.data) {
      if (!value || typeof value !== 'object' || value.id == null || ids.has(String(value.id))) {
        throw new Error(incompleteMessage)
      }
      ids.add(String(value.id))
      rows.push(value as Record<string, unknown>)
    }
    for (const client of meta.filters?.clients ?? []) clients.set(String(client.id ?? client.name), client)
    for (const person of meta.filters?.photographers ?? []) photographers.set(String(person.id ?? person.name), person)
    for (const service of meta.filters?.services ?? []) services.add(service)
    if (rows.length === total) return { rows, filters: { clients: [...clients.values()], photographers: [...photographers.values()], services: [...services].sort() } }
    if (!response.data.length || rows.length > total || page >= Math.ceil(total / perPage)) throw new Error(incompleteMessage)
  }
}

export function calendarRangeParams(
  range: ShootCalendarRange,
): { scheduled_start: string; scheduled_end: string } {
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (!isDate(range.start) || !isDate(range.end) || range.start > range.end) throw new Error('Choose a valid calendar date range.')
  return { scheduled_start: range.start, scheduled_end: range.end }
}

export function mapCalendarShoot(row: Record<string, unknown>, history = false): ShootData {
  const record = row as unknown as ShootHistoryRecord
  const source = history ? {
    ...row,
    address: record.address?.street || record.address?.full,
    city: record.address?.city,
    state: record.address?.state,
    zip: record.address?.zip,
    client: { ...record.client, company_name: record.client?.company, phonenumber: record.client?.phone },
    total_quote: record.financials?.totalQuote,
    base_quote: record.financials?.baseQuote,
    tax_amount: record.financials?.taxAmount,
    total_paid: record.financials?.totalPaid,
    shoot_notes: record.notes?.shoot,
    photographer_notes: record.notes?.photographer,
    company_notes: record.notes?.company,
    editor_notes: record.notes?.editing,
  } : row
  const schedule = getShootSchedule(source)
  return {
    ...mapShootApiToShootData(source),
    scheduledDate: schedule.date,
    time: schedule.time || 'TBD',
    timezone: typeof row.timezone === 'string' ? row.timezone : null,
  }
}
