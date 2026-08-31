export type ShootMapCoordinates = {
  lat: number
  lng: number
}

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null

  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

const toRangedNumber = (
  value: unknown,
  minimum: number,
  maximum: number,
): number | null => {
  const number = toFiniteNumber(value)
  if (number === null || number < minimum || number > maximum) return null
  return number
}

export const toValidLatitude = (value: unknown): number | null =>
  toRangedNumber(value, -90, 90)

export const toValidLongitude = (value: unknown): number | null =>
  toRangedNumber(value, -180, 180)

export const toValidMapCoordinates = (
  latitude: unknown,
  longitude: unknown,
): ShootMapCoordinates | null => {
  const lat = toValidLatitude(latitude)
  const lng = toValidLongitude(longitude)

  return lat === null || lng === null ? null : { lat, lng }
}
