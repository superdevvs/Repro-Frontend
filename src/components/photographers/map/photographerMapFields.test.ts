import { describe, expect, it } from 'vitest'
import {
  bufferPillLabel,
  photographerMapHasPins,
  readBookingJobCoords,
  readPhotographerMapFields,
} from './photographerMapFields'

describe('readPhotographerMapFields', () => {
  it('returns nulls when map is null (client fail-open)', () => {
    const fields = readPhotographerMapFields({ id: 1, name: 'Pat', distance: 3.2, map: null })
    expect(fields.photographer).toBeNull()
    expect(fields.last).toBeNull()
    expect(fields.next).toBeNull()
    expect(fields.job).toBeNull()
    expect(fields.miles).toBe(3.2)
    expect(fields.travelMinutesLastToJob).toBeNull()
    expect(fields.buffer).toBeNull()
    expect(photographerMapHasPins(fields)).toBe(false)
  })

  it('reads locked for-booking snake_case map payload', () => {
    const fields = readPhotographerMapFields({
      id: 42,
      miles_to_job: 12.4,
      map: {
        home: { lat: 38.89, lng: -77.08 },
        job: { lat: 38.8462, lng: -77.3064 },
        last_shoot: {
          shoot_id: 1001,
          address: '12 Previous Client Street',
          lat: 38.81,
          lng: -77.06,
          ends_at: '2026-09-15T10:00:00-04:00',
        },
        next_shoot: {
          shoot_id: 1002,
          address: '88 Later Lane',
          lat: 38.88,
          lng: -77.10,
          starts_at: '2026-09-15T15:00:00-04:00',
        },
        drive_minutes: {
          last_to_job: 18,
          job_to_next: 22,
          source: 'google_distance_matrix',
          is_estimate: false,
        },
        miles_to_job: 12.4,
        travel_risk: {
          last_to_job: 'tight',
          job_to_next: 'early',
          buffer_minutes: 15,
        },
      },
    })

    expect(fields.photographer).toEqual({ lat: 38.89, lng: -77.08 })
    expect(fields.job).toEqual({ lat: 38.8462, lng: -77.3064 })
    expect(fields.last?.coords).toEqual({ lat: 38.81, lng: -77.06 })
    expect(fields.last?.address).toBe('12 Previous Client Street')
    expect(fields.next?.coords).toEqual({ lat: 38.88, lng: -77.1 })
    expect(fields.miles).toBe(12.4)
    expect(fields.travelMinutesLastToJob).toBe(18)
    expect(fields.travelMinutesJobToNext).toBe(22)
    expect(fields.travelRiskLastToJob).toBe('tight')
    expect(fields.travelRiskJobToNext).toBe('early')
    expect(fields.buffer).toBe('tight') // worse of tight vs early
    expect(fields.bufferMinutes).toBe(15)
    expect(fields.isEstimate).toBe(false)
    expect(photographerMapHasPins(fields)).toBe(true)
  })

  it('accepts camelCase aliases from the contract', () => {
    const fields = readPhotographerMapFields({
      milesToJob: 4,
      map: {
        home: { lat: 1, lng: 2 },
        lastShoot: { lat: 3, lng: 4, shootId: 9 },
        nextShoot: { lat: 5, lng: 6 },
        driveMinutes: { lastToJob: 10, jobToNext: 11 },
        travelRisk: { lastToJob: 'late', jobToNext: 'early', bufferMinutes: 12 },
      },
    })
    expect(fields.photographer).toEqual({ lat: 1, lng: 2 })
    expect(fields.last?.coords).toEqual({ lat: 3, lng: 4 })
    expect(fields.travelMinutesLastToJob).toBe(10)
    expect(fields.buffer).toBe('late')
  })

  it('prefers map.job over fallback jobCoords', () => {
    const fields = readPhotographerMapFields({
      map: { job: { lat: 1, lng: 2 } },
    }, { lat: 9, lng: 9 })
    expect(fields.job).toEqual({ lat: 1, lng: 2 })
  })

  it('falls back to top-level job / jobCoords when map.job missing', () => {
    const fields = readPhotographerMapFields({
      map: { home: { lat: 1, lng: 2 } },
      job: { lat: 3, lng: 4, address: '500 Booking Avenue', city: 'Fairfax', state: 'VA' },
    })
    expect(fields.job).toEqual({ lat: 3, lng: 4 })
    expect(fields.jobAddress).toContain('500 Booking Avenue')
  })

  it('normalizes buffer pill labels', () => {
    expect(bufferPillLabel('early')).toBe('~early')
    expect(bufferPillLabel('late')).toBe('late risk')
  })

  it('reads top-level booking job echo', () => {
    expect(readBookingJobCoords({
      job: { lat: 38.8, lng: -77.3 },
      data: [],
    })).toEqual({ lat: 38.8, lng: -77.3 })
  })
})
