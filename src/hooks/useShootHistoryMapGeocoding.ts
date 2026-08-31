import { useEffect, useMemo, useState } from 'react'
import { toValidMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'
import type {
  AvailableTab,
  HistoryFiltersState,
} from '@/components/shoots/history/shootHistoryUtils'
import type { ShootData, ShootHistoryRecord } from '@/types/shoots'
import { getCoordinatesFromAddress } from '@/utils/distanceUtils'

export type ShootHistoryGeoCache = Record<string, { lat: number; lng: number }>

type MapGeocodeCandidate = {
  cacheKey: string
  address: string
  city: string
  state: string
  zip: string
}

type UseShootHistoryMapGeocodingArgs = {
  activeTab: AvailableTab
  historyFilters: Pick<HistoryFiltersState, 'viewAs' | 'groupBy'>
  historyRecords: ShootHistoryRecord[]
  viewMode: 'grid' | 'list' | 'map'
  operationalData: ShootData[]
}

const parseStoredGeoCache = (value: unknown): ShootHistoryGeoCache => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value).reduce<ShootHistoryGeoCache>((cache, [address, coordinates]) => {
    if (!coordinates || typeof coordinates !== 'object' || Array.isArray(coordinates)) {
      return cache
    }

    const rawCoordinates = coordinates as { lat?: unknown; lng?: unknown }
    const validCoordinates = toValidMapCoordinates(rawCoordinates.lat, rawCoordinates.lng)
    if (validCoordinates) cache[address] = validCoordinates
    return cache
  }, {})
}

export const useShootHistoryMapGeocoding = ({
  activeTab,
  historyFilters,
  historyRecords,
  viewMode,
  operationalData,
}: UseShootHistoryMapGeocodingArgs) => {
  const [geoCache, setGeoCache] = useState<ShootHistoryGeoCache>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('shootGeoCache')
      if (stored) setGeoCache(parseStoredGeoCache(JSON.parse(stored)))
    } catch {
      // Ignore malformed or unavailable browser storage.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('shootGeoCache', JSON.stringify(geoCache))
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [geoCache])

  const candidates = useMemo<MapGeocodeCandidate[]>(() => {
    if (activeTab === 'history') {
      if (historyFilters.viewAs !== 'map' || historyFilters.groupBy === 'services') return []
      return historyRecords
        .map((record) => {
          const address = record.address
          const cacheKey = address?.full?.trim()
          if (!cacheKey || toValidMapCoordinates(address.latitude, address.longitude)) return null
          return {
            cacheKey,
            address: address.street || cacheKey,
            city: address.city || '',
            state: address.state || '',
            zip: address.zip || '',
          }
        })
        .filter((candidate): candidate is MapGeocodeCandidate => Boolean(candidate))
    }

    if (viewMode !== 'map') return []
    return operationalData
      .map((shoot) => {
        const location = shoot.location
        const cacheKey = location.fullAddress?.trim()
        if (!cacheKey || toValidMapCoordinates(location.latitude, location.longitude)) return null
        return {
          cacheKey,
          address: location.address || cacheKey,
          city: location.city || '',
          state: location.state || '',
          zip: location.zip || '',
        }
      })
      .filter((candidate): candidate is MapGeocodeCandidate => Boolean(candidate))
  }, [activeTab, historyFilters, historyRecords, operationalData, viewMode])

  useEffect(() => {
    const candidatesByAddress = new Map(
      candidates
        .filter((candidate) => {
          const cached = geoCache[candidate.cacheKey]
          return !toValidMapCoordinates(cached?.lat, cached?.lng)
        })
        .map((candidate) => [candidate.cacheKey, candidate]),
    )
    const unknownAddresses = Array.from(candidatesByAddress.values())
    if (!unknownAddresses.length) return undefined

    let cancelled = false

    const geocode = async () => {
      const updates: ShootHistoryGeoCache = {}
      let nextCandidateIndex = 0

      const geocodeNext = async (): Promise<void> => {
        while (!cancelled) {
          const candidate = unknownAddresses[nextCandidateIndex]
          nextCandidateIndex += 1
          if (!candidate) return

          const coordinates = await getCoordinatesFromAddress(
            candidate.address,
            candidate.city,
            candidate.state,
            candidate.zip,
          )
          const validCoordinates = toValidMapCoordinates(coordinates?.lat, coordinates?.lon)
          if (validCoordinates) updates[candidate.cacheKey] = validCoordinates
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(3, unknownAddresses.length) }, geocodeNext),
      )

      if (!cancelled && Object.keys(updates).length) {
        setGeoCache((previous) => ({ ...previous, ...updates }))
      }
    }

    void geocode()
    return () => {
      cancelled = true
    }
  }, [candidates, geoCache])

  return { geoCache, setGeoCache }
}
