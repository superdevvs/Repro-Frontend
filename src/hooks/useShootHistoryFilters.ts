import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AvailableTab,
  DEFAULT_HISTORY_FILTERS,
  DEFAULT_OPERATIONAL_FILTERS,
  HistoryFiltersState,
  OperationalFiltersState,
} from '@/components/shoots/history/shootHistoryUtils'

type UseShootHistoryFiltersArgs = {
  role: string | null | undefined
  isEditor: boolean
  canViewHistory: boolean
}

export const useShootHistoryFilters = ({
  role,
  isEditor,
  canViewHistory,
}: UseShootHistoryFiltersArgs) => {
  const [searchParams, setSearchParams] = useSearchParams()

  const tabList: AvailableTab[] = useMemo(() => {
    if (isEditor) {
      return canViewHistory ? ['editing', 'edited', 'history'] : ['editing', 'edited']
    }
    const tabs: AvailableTab[] = canViewHistory
      ? ['scheduled', 'completed', 'delivered', 'hold', 'history']
      : ['scheduled', 'completed', 'delivered', 'hold']
    return tabs
  }, [canViewHistory, isEditor])

  const [activeTab, setActiveTab] = useState<AvailableTab>(() => {
    const urlTab = searchParams.get('tab') as AvailableTab | null
    return urlTab && tabList.includes(urlTab) ? urlTab : tabList[0]
  })

  const [inProgressSubTab, setInProgressSubTab] = useState<'all' | 'uploaded' | 'editing' | 'in_review'>('all')
  const hideDeliveredSubTabs = ['client', 'editor', 'photographer'].includes(role || '')
  const [deliveredSubTab, setDeliveredSubTab] = useState<'all' | 'delivered' | 'ready'>('all')
  const [holdSubTab, setHoldSubTab] = useState<'all' | 'on_hold' | 'cancelled'>('all')
  const [historySubTab, setHistorySubTab] = useState<'all' | 'mls-queue'>('all')
  const [scheduledSubTab, setScheduledSubTab] = useState<'all' | 'requested' | 'scheduled'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shootHistory_viewMode')
      if (saved && ['grid', 'list', 'map'].includes(saved)) {
        return saved as 'grid' | 'list' | 'map'
      }
    }
    return 'list'
  })
  const [pinnedTabs, setPinnedTabs] = useState<Set<AvailableTab>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shootHistory_pinnedTabs')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          const parsedTabs = Array.isArray(parsed)
            ? parsed.filter((tab): tab is AvailableTab => typeof tab === 'string')
            : []
          return new Set<AvailableTab>(parsedTabs)
        } catch {
          return new Set<AvailableTab>()
        }
      }
    }
    return new Set<AvailableTab>()
  })
  const [operationalFilters, setOperationalFilters] = useState<OperationalFiltersState>(DEFAULT_OPERATIONAL_FILTERS)

  const defaultHistoryDateRange = isEditor ? 'all' : DEFAULT_HISTORY_FILTERS.dateRange
  const defaultHistoryFilters = useMemo<HistoryFiltersState>(
    () => ({ ...DEFAULT_HISTORY_FILTERS, dateRange: defaultHistoryDateRange }),
    [defaultHistoryDateRange],
  )
  const [historyFilters, setHistoryFilters] = useState<HistoryFiltersState>(defaultHistoryFilters)

  const hasAppliedPinnedTab = useRef(false)

  useEffect(() => {
    const urlTab = searchParams.get('tab') as AvailableTab | null
    if (urlTab && tabList.includes(urlTab) && !hasAppliedPinnedTab.current) {
      setActiveTab(urlTab)
      setSearchParams((prev) => {
        prev.delete('tab')
        return prev
      }, { replace: true })
      hasAppliedPinnedTab.current = true
      return
    }

    const pinnedArray = Array.from(pinnedTabs)
    if (pinnedArray.length > 0 && !hasAppliedPinnedTab.current) {
      const pinnedTab = pinnedArray.find((tab) => tabList.includes(tab as AvailableTab))
      if (pinnedTab) {
        setActiveTab(pinnedTab as AvailableTab)
        hasAppliedPinnedTab.current = true
        return
      }
    }

    if (!tabList.includes(activeTab)) {
      setActiveTab(tabList[0])
    }

    if (!hasAppliedPinnedTab.current) {
      hasAppliedPinnedTab.current = true
    }
  }, [activeTab, pinnedTabs, searchParams, setSearchParams, tabList])

  useEffect(() => {
    const urlRange = searchParams.get('range')
    if (urlRange !== 'mtd') return

    setOperationalFilters((prev) =>
      prev.dateRange === 'this_month' ? prev : { ...prev, dateRange: 'this_month' },
    )

    setHistoryFilters((prev) =>
      prev.dateRange === 'this_month' ? prev : { ...prev, dateRange: 'this_month' },
    )

    setSearchParams((prev) => {
      prev.delete('range')
      return prev
    }, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shootHistory_viewMode', viewMode)
    }
  }, [viewMode])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shootHistory_pinnedTabs', JSON.stringify(Array.from(pinnedTabs)))
    }
  }, [pinnedTabs])

  useEffect(() => {
    if (activeTab === 'scheduled' && viewMode !== 'list') {
      const saved = localStorage.getItem('shootHistory_viewMode')
      if (!saved || saved === 'list') {
        setViewMode('list')
      }
    }
  }, [activeTab, viewMode])

  useEffect(() => {
    if (activeTab !== 'scheduled') setScheduledSubTab('all')
    if (activeTab !== 'completed') setInProgressSubTab('all')
    if (activeTab !== 'delivered') setDeliveredSubTab('all')
    if (activeTab !== 'hold') setHoldSubTab('all')
  }, [activeTab, hideDeliveredSubTabs])

  const togglePinTab = (tabValue: AvailableTab) => {
    setPinnedTabs((prev) => {
      const next = new Set(prev)
      if (next.has(tabValue)) {
        next.delete(tabValue)
      } else {
        next.clear()
        next.add(tabValue)
        setActiveTab(tabValue)
      }
      return next
    })
  }

  const resetOperationalFilters = () => {
    setOperationalFilters(DEFAULT_OPERATIONAL_FILTERS)
  }

  const resetHistoryFilters = () => {
    setHistoryFilters(defaultHistoryFilters)
  }

  const onOperationalFilterChange = <K extends keyof OperationalFiltersState>(
    key: K,
    value: OperationalFiltersState[K],
  ) => {
    if ((key === 'clientId' || key === 'photographerId') && value === 'all') {
      setOperationalFilters((prev) => ({ ...prev, [key]: '' as OperationalFiltersState[K] }))
    } else {
      setOperationalFilters((prev) => ({ ...prev, [key]: value }))
    }
  }

  const onHistoryFilterChange = <K extends keyof HistoryFiltersState>(
    key: K,
    value: HistoryFiltersState[K],
  ) => {
    const processedValue = (key === 'clientId' || key === 'photographerId') && value === 'all'
      ? ('' as HistoryFiltersState[K])
      : value
    setHistoryFilters((prev) => {
      const next = { ...prev, [key]: processedValue }
      if (key === 'groupBy' && processedValue === 'services') {
        next.viewAs = 'list'
      }
      return next
    })
  }

  return {
    searchParams,
    setSearchParams,
    tabList,
    activeTab,
    setActiveTab,
    inProgressSubTab,
    setInProgressSubTab,
    hideDeliveredSubTabs,
    deliveredSubTab,
    setDeliveredSubTab,
    holdSubTab,
    setHoldSubTab,
    historySubTab,
    setHistorySubTab,
    scheduledSubTab,
    setScheduledSubTab,
    viewMode,
    setViewMode,
    pinnedTabs,
    setPinnedTabs,
    togglePinTab,
    operationalFilters,
    setOperationalFilters,
    historyFilters,
    setHistoryFilters,
    defaultHistoryFilters,
    resetOperationalFilters,
    resetHistoryFilters,
    onOperationalFilterChange,
    onHistoryFilterChange,
  }
}
