import { describe, expect, it } from 'vitest'
import { buildPhotographerMapMarkers } from './buildPhotographerMapMarkers'
import type { PhotographerMapFields } from './photographerMapFields'

const base: PhotographerMapFields = {
  photographer: { lat: 1, lng: 2 },
  last: { coords: { lat: 3, lng: 4 }, address: 'Last St', shootId: 1, at: null },
  job: { lat: 5, lng: 6 },
  jobAddress: 'Job Ave',
  next: { coords: { lat: 7, lng: 8 }, address: 'Next Ln', shootId: 2, at: null },
  miles: 2,
  travelMinutesLastToJob: 10,
  travelMinutesJobToNext: 15,
  driveSource: 'google_distance_matrix',
  isEstimate: false,
  travelRiskLastToJob: 'tight',
  travelRiskJobToNext: 'early',
  buffer: 'tight',
  bufferMinutes: 15,
}

describe('buildPhotographerMapMarkers', () => {
  it('omits pins when coordinates are absent', () => {
    expect(buildPhotographerMapMarkers({
      fields: {
        ...base,
        photographer: null,
        last: null,
        job: null,
        next: null,
      },
      photographerName: 'Pat',
    })).toEqual([])
  })

  it('builds last/job/home/next markers from locked map shape', () => {
    const markers = buildPhotographerMapMarkers({
      fields: base,
      photographerName: 'Pat',
      photographerId: '9',
    })
    expect(markers.map((marker) => marker.kind)).toEqual(['last', 'job', 'photographer', 'next'])
    expect(markers.find((marker) => marker.kind === 'photographer')?.label).toBe('Pat')
    expect(markers.find((marker) => marker.kind === 'last')?.coords).toEqual({ lat: 3, lng: 4 })
    expect(markers.find((marker) => marker.kind === 'job')?.label).toBe('Job Ave')
  })
})
