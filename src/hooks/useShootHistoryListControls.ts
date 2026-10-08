import { useEffect, useRef, useState } from 'react'
import type { AvailableTab, HistoryFiltersState, OperationalFiltersState } from '@/components/shoots/history/shootHistoryUtils'

/** Own list pagination and filter debounce independently of fetching and shoot actions. */
export function useShootHistoryListControls(activeTab: AvailableTab, scope: string, operationalFilters: OperationalFiltersState, historyFilters: HistoryFiltersState) {
  const [operationalPage, setOperationalPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const operationalPageRef = useRef(operationalPage)
  operationalPageRef.current = operationalPage
  const historyPageRef = useRef(historyPage)
  historyPageRef.current = historyPage
  const [debouncedOperationalSearch, setDebouncedOperationalSearch] = useState(() => operationalFilters.search.trim())
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState(() => historyFilters.search.trim())
  const debouncedOperationalSearchRef = useRef(debouncedOperationalSearch)
  debouncedOperationalSearchRef.current = debouncedOperationalSearch
  const debouncedHistorySearchRef = useRef(debouncedHistorySearch)
  debouncedHistorySearchRef.current = debouncedHistorySearch
  const operationalListFiltersKey = JSON.stringify({
    clientId: operationalFilters.clientId, photographerId: operationalFilters.photographerId,
    salesRepId: operationalFilters.salesRepId,
    address: operationalFilters.address, services: operationalFilters.services,
    dateRange: operationalFilters.dateRange, scheduledStart: operationalFilters.scheduledStart,
    scheduledEnd: operationalFilters.scheduledEnd,
  })
  const historyListFiltersKey = JSON.stringify({
    clientId: historyFilters.clientId, photographerId: historyFilters.photographerId,
    salesRepId: historyFilters.salesRepId,
    services: historyFilters.services, dateRange: historyFilters.dateRange,
    scheduledStart: historyFilters.scheduledStart, scheduledEnd: historyFilters.scheduledEnd,
    completedStart: historyFilters.completedStart, completedEnd: historyFilters.completedEnd,
    groupBy: historyFilters.groupBy, viewAs: historyFilters.viewAs,
  })
  const lastScope = useRef(scope)
  useEffect(() => {
    if (lastScope.current === scope) return
    lastScope.current = scope
    if (activeTab === 'history') {
      historyPageRef.current = 1
      setHistoryPage(1)
    } else {
      operationalPageRef.current = 1
      setOperationalPage(1)
    }
  }, [activeTab, scope])
  useEffect(() => {
    const next = operationalFilters.search.trim()
    if (next === debouncedOperationalSearch) return
    const timer = window.setTimeout(() => {
      setDebouncedOperationalSearch(next)
      operationalPageRef.current = 1
      setOperationalPage(1)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [operationalFilters.search, debouncedOperationalSearch])
  useEffect(() => {
    const next = historyFilters.search.trim()
    if (next === debouncedHistorySearch) return
    const timer = window.setTimeout(() => {
      setDebouncedHistorySearch(next)
      historyPageRef.current = 1
      setHistoryPage(1)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [historyFilters.search, debouncedHistorySearch])
  const lastOperationalFilters = useRef(operationalListFiltersKey)
  useEffect(() => {
    if (lastOperationalFilters.current === operationalListFiltersKey) return
    lastOperationalFilters.current = operationalListFiltersKey
    operationalPageRef.current = 1
    setOperationalPage(1)
  }, [operationalListFiltersKey])
  const lastHistoryFilters = useRef(historyListFiltersKey)
  useEffect(() => {
    if (lastHistoryFilters.current === historyListFiltersKey) return
    lastHistoryFilters.current = historyListFiltersKey
    historyPageRef.current = 1
    setHistoryPage(1)
  }, [historyListFiltersKey])
  return {
    operationalPage, setOperationalPage, operationalPageRef, historyPage, setHistoryPage, historyPageRef,
    debouncedOperationalSearch, debouncedOperationalSearchRef, debouncedHistorySearch, debouncedHistorySearchRef,
    operationalListFiltersKey, historyListFiltersKey,
  }
}
