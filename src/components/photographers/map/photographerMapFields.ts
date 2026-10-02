import { toValidMapCoordinates, type ShootMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'

export type PhotographerMapBuffer = 'early' | 'tight' | 'late'

export type PhotographerMapPinKind = 'photographer' | 'last' | 'job' | 'next'

export type PhotographerMapNeighbor = {
  coords: ShootMapCoordinates
  address: string | null
  shootId: number | null
  at: string | null
}

export type PhotographerMapFields = {
  /** `map.home` — photographer home pin */
  photographer: ShootMapCoordinates | null
  last: PhotographerMapNeighbor | null
  job: ShootMapCoordinates | null
  jobAddress: string | null
  next: PhotographerMapNeighbor | null
  miles: number | null
  travelMinutesLastToJob: number | null
  travelMinutesJobToNext: number | null
  driveSource: string | null
  isEstimate: boolean | null
  travelRiskLastToJob: PhotographerMapBuffer | null
  travelRiskJobToNext: PhotographerMapBuffer | null
  /** Worst of last→job / job→next risks for the strip pill */
  buffer: PhotographerMapBuffer | null
  bufferMinutes: number | null
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const firstDefined = (...values: unknown[]): unknown =>
  values.find((value) => value !== null && value !== undefined && value !== '')

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const readCoords = (...pairs: Array<[unknown, unknown]>): ShootMapCoordinates | null => {
  for (const [lat, lng] of pairs) {
    const coords = toValidMapCoordinates(lat, lng)
    if (coords) return coords
  }
  return null
}

const readNestedCoords = (value: unknown): ShootMapCoordinates | null => {
  const row = asRecord(value)
  return readCoords(
    [row.lat, row.lng],
    [row.latitude, row.longitude],
    [row.lat, row.lon],
  )
}

const readBuffer = (value: unknown): PhotographerMapBuffer | null => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (normalized === 'early' || normalized === 'early_risk' || normalized === '~early') return 'early'
  if (normalized === 'tight' || normalized === 'tight_risk') return 'tight'
  if (normalized === 'late' || normalized === 'late_risk') return 'late'
  return null
}

const riskRank = (value: PhotographerMapBuffer | null): number => {
  if (value === 'late') return 3
  if (value === 'tight') return 2
  if (value === 'early') return 1
  return 0
}

const worseRisk = (
  a: PhotographerMapBuffer | null,
  b: PhotographerMapBuffer | null,
): PhotographerMapBuffer | null => (riskRank(a) >= riskRank(b) ? a : b)

const readNeighbor = (value: unknown): PhotographerMapNeighbor | null => {
  if (value === null || value === undefined) return null
  const row = asRecord(value)
  const coords = readNestedCoords(row)
  if (!coords) return null
  return {
    coords,
    address: typeof row.address === 'string' && row.address.trim() ? row.address.trim() : null,
    shootId: toFiniteNumber(firstDefined(row.shoot_id, row.shootId)),
    at: typeof firstDefined(row.ends_at, row.endsAt, row.starts_at, row.startsAt) === 'string'
      ? String(firstDefined(row.ends_at, row.endsAt, row.starts_at, row.startsAt))
      : null,
  }
}

const formatJobAddress = (job: Record<string, unknown>): string | null => {
  const address = typeof job.address === 'string' ? job.address.trim() : ''
  if (address) {
    const city = typeof job.city === 'string' ? job.city.trim() : ''
    const state = typeof job.state === 'string' ? job.state.trim() : ''
    const zip = typeof job.zip === 'string' ? job.zip.trim() : ''
    const tail = [city, state].filter(Boolean).join(', ')
    return [address, tail, zip].filter(Boolean).join(tail || zip ? ', ' : '')
  }
  return null
}

/**
 * Prefer locked for-booking snake_case (`map.home`, `miles_to_job`, `travel_risk`, …).
 * CamelCase aliases from the BE contract are accepted. Missing values fail open (null).
 * Anonymous/client responses with `map: null` degrade without blocking assignment.
 */
export function readPhotographerMapFields(
  photographer: unknown,
  jobCoords?: ShootMapCoordinates | null,
): PhotographerMapFields {
  const row = asRecord(photographer)
  // `map: null` (client/anonymous) → empty object → all nested nulls
  const mapRaw = firstDefined(row.map, row.mapFields, row.map_fields)
  const map = mapRaw === null ? {} : asRecord(mapRaw)

  const home = readNestedCoords(firstDefined(map.home, map.photographer))
    ?? readCoords(
      [row.latitude, row.longitude],
      [row.lat, row.lng],
    )

  const last = readNeighbor(firstDefined(map.last_shoot, map.lastShoot, map.last, row.last_shoot, row.lastShoot))
  const next = readNeighbor(firstDefined(map.next_shoot, map.nextShoot, map.next, row.next_shoot, row.nextShoot))

  const topJob = asRecord(firstDefined(row.job, map.job))
  const mapJob = readNestedCoords(firstDefined(map.job, row.job))
  const job = mapJob ?? jobCoords ?? null
  const jobAddress = formatJobAddress(topJob)

  const drive = asRecord(firstDefined(map.drive_minutes, map.driveMinutes))
  const travelMinutesLastToJob = toFiniteNumber(firstDefined(
    drive.last_to_job,
    drive.lastToJob,
    row.travel_minutes_last_to_job,
  ))
  const travelMinutesJobToNext = toFiniteNumber(firstDefined(
    drive.job_to_next,
    drive.jobToNext,
    row.travel_minutes_job_to_next,
  ))

  const risk = asRecord(firstDefined(map.travel_risk, map.travelRisk))
  const travelRiskLastToJob = readBuffer(firstDefined(risk.last_to_job, risk.lastToJob))
  const travelRiskJobToNext = readBuffer(firstDefined(risk.job_to_next, risk.jobToNext))
  const buffer = worseRisk(travelRiskLastToJob, travelRiskJobToNext)
  const bufferMinutes = toFiniteNumber(firstDefined(risk.buffer_minutes, risk.bufferMinutes))

  const miles = toFiniteNumber(firstDefined(
    row.miles_to_job,
    row.milesToJob,
    map.miles_to_job,
    map.milesToJob,
    row.distance,
  ))

  return {
    photographer: home,
    last,
    job,
    jobAddress,
    next,
    miles,
    travelMinutesLastToJob,
    travelMinutesJobToNext,
    driveSource: typeof firstDefined(drive.source) === 'string' ? String(drive.source) : null,
    isEstimate: typeof drive.is_estimate === 'boolean'
      ? drive.is_estimate
      : typeof drive.isEstimate === 'boolean'
        ? drive.isEstimate
        : null,
    travelRiskLastToJob,
    travelRiskJobToNext,
    buffer,
    bufferMinutes,
  }
}

export function photographerMapHasPins(fields: PhotographerMapFields): boolean {
  return Boolean(fields.photographer || fields.last || fields.job || fields.next)
}

export function bufferPillLabel(buffer: PhotographerMapBuffer): string {
  if (buffer === 'early') return '~early'
  if (buffer === 'tight') return 'tight'
  return 'late risk'
}

/** Read top-level for-booking `job` echo for shared job pin. */
export function readBookingJobCoords(payload: unknown): ShootMapCoordinates | null {
  const root = asRecord(payload)
  return readNestedCoords(firstDefined(root.job, asRecord(root.data).job))
}
