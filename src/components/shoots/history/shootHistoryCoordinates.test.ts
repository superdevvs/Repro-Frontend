import { describe, expect, it } from 'vitest'
import {
  toValidLatitude,
  toValidLongitude,
  toValidMapCoordinates,
} from './shootHistoryCoordinates'

describe('shoot history coordinates', () => {
  it('normalizes finite numeric API coordinates, including zero', () => {
    expect(toValidMapCoordinates('0', 0)).toEqual({ lat: 0, lng: 0 })
    expect(toValidMapCoordinates('38.9072', '-77.0369')).toEqual({
      lat: 38.9072,
      lng: -77.0369,
    })
  })

  it('rejects incomplete, non-finite, and out-of-range coordinate pairs', () => {
    expect(toValidMapCoordinates(38.9, undefined)).toBeNull()
    expect(toValidMapCoordinates('   ', '-77')).toBeNull()
    expect(toValidMapCoordinates(true, -77)).toBeNull()
    expect(toValidMapCoordinates(Number.NaN, -77)).toBeNull()
    expect(toValidMapCoordinates(91, -77)).toBeNull()
    expect(toValidMapCoordinates(38.9, -181)).toBeNull()
  })

  it('accepts the inclusive geographic boundaries', () => {
    expect(toValidLatitude(-90)).toBe(-90)
    expect(toValidLatitude(90)).toBe(90)
    expect(toValidLongitude(-180)).toBe(-180)
    expect(toValidLongitude(180)).toBe(180)
  })
})
