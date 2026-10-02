import { describe, expect, it, vi } from 'vitest'
import { buildPhotographerMapMarkers } from './buildPhotographerMapMarkers'
import type { PhotographerMapFields } from './photographerMapFields'

vi.mock('@/utils/defaultAvatars', () => ({
  getAvatarUrl: (avatar: string | null | undefined, _role?: string, _g?: unknown, id?: string | number) =>
    avatar || `/avatars/mock-${id ?? 'x'}.png`,
}))

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
      photographerId: '9',
    })).toEqual([])
  })

  it('builds last/job/home/next markers from locked map shape when selected', () => {
    const markers = buildPhotographerMapMarkers({
      fields: base,
      photographerName: 'Pat',
      photographerId: '9',
    })
    expect(markers.map((marker) => marker.kind)).toEqual(['last', 'job', 'photographer', 'next'])
    expect(markers.find((marker) => marker.kind === 'photographer')?.label).toBe('Pat')
    expect(markers.find((marker) => marker.kind === 'last')?.coords).toEqual({ lat: 3, lng: 4 })
    expect(markers.find((marker) => marker.kind === 'job')?.label).toBe('Job Ave')
    expect(markers.find((marker) => marker.kind === 'job')?.appearance).toBe('home')
  })

  it('overview mode shows avatar homes for all photographers plus job', () => {
    const markers = buildPhotographerMapMarkers({
      fields: { ...base, photographer: null, last: null, next: null },
      photographerId: null,
      jobCoords: { lat: 5, lng: 6 },
      photographers: [
        { id: '1', name: 'Alex Rivera', avatar: '/a.png', map: { home: { lat: 10, lng: 11 } } },
        { id: '2', name: 'Blake', map: { home: { lat: 12, lng: 13 } } },
      ],
    })
    expect(markers.filter((m) => m.appearance === 'avatar')).toHaveLength(2)
    expect(markers.find((m) => m.kind === 'job')?.appearance).toBe('home')
    expect(markers.find((m) => m.photographerId === '1')?.initials).toBe('AR')
  })

  it('selected mode dims other photographer homes', () => {
    const markers = buildPhotographerMapMarkers({
      fields: base,
      photographerName: 'Alex Rivera',
      photographerId: '1',
      photographers: [
        { id: '1', name: 'Alex Rivera', map: { home: { lat: 1, lng: 2 } } },
        { id: '2', name: 'Blake', map: { home: { lat: 12, lng: 13 } } },
      ],
    })
    const context = markers.filter((m) => m.dimmed)
    expect(context).toHaveLength(1)
    expect(context[0].photographerId).toBe('2')
    expect(context[0].appearance).toBe('dot')
    expect(markers.some((m) => m.kind === 'last')).toBe(true)
    expect(markers.find((m) => m.kind === 'job')?.appearance).toBe('home')
  })
})
