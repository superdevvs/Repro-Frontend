import type { PhotographerMapFields } from './photographerMapFields'
import type { PhotographerMapMarker } from './PhotographerPickerGoogleMap'

export function buildPhotographerMapMarkers(args: {
  fields: PhotographerMapFields
  photographerName?: string | null
  photographerId?: string | null
}): PhotographerMapMarker[] {
  const { fields, photographerName, photographerId } = args
  const markers: PhotographerMapMarker[] = []
  const idBase = photographerId || photographerName || 'selected'

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
    })
  }
  if (fields.job) {
    markers.push({
      id: `${idBase}-job`,
      kind: 'job',
      coords: fields.job,
      label: fields.jobAddress || 'Job location',
      detail: fields.miles !== null ? `${fields.miles.toFixed(1)} mi` : null,
    })
  }
  if (fields.photographer) {
    markers.push({
      id: `${idBase}-photographer`,
      kind: 'photographer',
      coords: fields.photographer,
      label: photographerName?.trim() || 'Photographer',
      detail: fields.miles !== null ? `${fields.miles.toFixed(1)} mi` : null,
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
    })
  }
  return markers
}
