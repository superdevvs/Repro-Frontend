import { getAvatarUrl } from '@/utils/defaultAvatars'
import type { ShootMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'
import {
  readPhotographerMapFields,
  type PhotographerMapFields,
  type PhotographerMapPinKind,
} from './photographerMapFields'
import { photographerInitials } from './photographerMapPinIcons'

export type PhotographerMapMarkerAppearance = 'avatar' | 'pin' | 'dot' | 'home'

export type PhotographerMapMarker = {
  id: string
  kind: PhotographerMapPinKind | 'home'
  coords: { lat: number; lng: number }
  label: string
  detail?: string | null
  /** List / pin selection target */
  photographerId?: string | null
  avatarUrl?: string | null
  initials?: string | null
  appearance?: PhotographerMapMarkerAppearance
  /** Dimmed context home in selected mode */
  dimmed?: boolean
  /** Selected photographer home (avatar or pin) */
  selected?: boolean
}

/** Loose photographer row from any picker list (booking / overview / approve / modify). */
export type PhotographerListEntry = {
  id?: string | number | null
  name?: string | null
  avatar?: string | null
  map?: unknown
  latitude?: unknown
  longitude?: unknown
  lat?: unknown
  lng?: unknown
  miles_to_job?: number | null
  milesToJob?: number | null
  distance?: number | string | null
}

function entryId(entry: PhotographerListEntry): string {
  return String(entry.id ?? '').trim()
}

function milesLabel(entry: PhotographerListEntry, fields: PhotographerMapFields): string | null {
  const miles = fields.miles
  if (miles !== null && Number.isFinite(miles)) return `${miles.toFixed(1)} mi`
  const raw = entry.miles_to_job ?? entry.milesToJob ?? entry.distance
  const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''))
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)} mi` : null
}

function homeCoords(
  entry: PhotographerListEntry,
  jobCoords?: ShootMapCoordinates | null,
): ShootMapCoordinates | null {
  return readPhotographerMapFields(entry, jobCoords).photographer
}

/**
 * Overview (no selection): avatar/profile pins for every photographer home + shared job.
 * Selected: route pins (last→job→next + selected home) + dimmed blue dots for other homes.
 */
export function buildPhotographerMapMarkers(args: {
  fields: PhotographerMapFields
  photographerName?: string | null
  photographerId?: string | null
  photographers?: ReadonlyArray<PhotographerListEntry | Record<string, unknown> | unknown> | null
  jobCoords?: ShootMapCoordinates | null
}): PhotographerMapMarker[] {
  const {
    fields,
    photographerName,
    photographerId,
    photographers = [],
    jobCoords = null,
  } = args
  const selectedId = String(photographerId ?? '').trim()
  const hasSelection = Boolean(selectedId)
  const list = (Array.isArray(photographers) ? photographers : [])
    .map((entry) => entry as PhotographerListEntry)
  const markers: PhotographerMapMarker[] = []
  const sharedJob = fields.job ?? jobCoords ?? null
  const sharedJobAddress = fields.jobAddress || 'Job location'

  if (!hasSelection) {
    for (const entry of list) {
      const id = entryId(entry)
      if (!id) continue
      const home = homeCoords(entry, jobCoords)
      if (!home) continue
      const name = String(entry.name ?? '').trim() || 'Photographer'
      const entryFields = readPhotographerMapFields(entry, jobCoords)
      const miles = milesLabel(entry, entryFields)
      markers.push({
        id: `${id}-home`,
        kind: 'home',
        coords: home,
        label: name,
        detail: miles,
        photographerId: id,
        avatarUrl: getAvatarUrl(entry.avatar, 'photographer', undefined, id),
        initials: photographerInitials(name),
        appearance: 'avatar',
        selected: false,
      })
    }
    if (sharedJob) {
      markers.push({
        id: 'shared-job',
        kind: 'job',
        coords: sharedJob,
        label: sharedJobAddress,
        detail: null,
        appearance: 'home',
      })
    }
    return markers
  }

  // Selected mode — other photographers as dimmed context dots
  for (const entry of list) {
    const id = entryId(entry)
    if (!id || id === selectedId) continue
    const home = homeCoords(entry, jobCoords)
    if (!home) continue
    const name = String(entry.name ?? '').trim() || 'Photographer'
    markers.push({
      id: `${id}-home-context`,
      kind: 'home',
      coords: home,
      label: name,
      detail: milesLabel(entry, readPhotographerMapFields(entry, jobCoords)),
      photographerId: id,
      avatarUrl: getAvatarUrl(entry.avatar, 'photographer', undefined, id),
      initials: photographerInitials(name),
      appearance: 'dot',
      dimmed: true,
      selected: false,
    })
  }

  const idBase = selectedId || photographerName || 'selected'

  if (fields.last) {
    const travel = fields.travelMinutesLastToJob !== null
      ? `${Math.round(fields.travelMinutesLastToJob)} min to job`
      : null
    markers.push({
      id: `${idBase}-last`,
      kind: 'last',
      coords: fields.last.coords,
      label: fields.last.address || 'Last stop',
      detail: [travel, fields.last.at].filter(Boolean).join(' · ') || null,
      appearance: 'pin',
    })
  }
  if (fields.job || sharedJob) {
    markers.push({
      id: `${idBase}-job`,
      kind: 'job',
      coords: (fields.job ?? sharedJob)!,
      label: fields.jobAddress || sharedJobAddress,
      detail: fields.miles !== null ? `${fields.miles.toFixed(1)} mi` : null,
      appearance: 'home',
    })
  }
  if (fields.photographer) {
    const name = photographerName?.trim() || 'Photographer'
    const selectedEntry = list.find((entry) => entryId(entry) === selectedId)
    markers.push({
      id: `${idBase}-photographer`,
      kind: 'photographer',
      coords: fields.photographer,
      label: name,
      detail: fields.miles !== null ? `${fields.miles.toFixed(1)} mi` : null,
      photographerId: selectedId || null,
      avatarUrl: selectedEntry
        ? getAvatarUrl(selectedEntry.avatar, 'photographer', undefined, selectedId)
        : null,
      initials: photographerInitials(name),
      appearance: 'pin',
      selected: true,
    })
  }
  if (fields.next) {
    const travel = fields.travelMinutesJobToNext !== null
      ? `${Math.round(fields.travelMinutesJobToNext)} min from job`
      : null
    markers.push({
      id: `${idBase}-next`,
      kind: 'next',
      coords: fields.next.coords,
      label: fields.next.address || 'Next stop',
      detail: [travel, fields.next.at].filter(Boolean).join(' · ') || null,
      appearance: 'pin',
    })
  }
  return markers
}
