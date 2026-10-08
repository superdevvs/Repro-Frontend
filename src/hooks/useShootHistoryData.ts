import { shootHistoryPersonParams } from './shootHistoryPersonFilters'
import { canSendShootToEditing } from '@/utils/shootEditingEligibility';
import type { ShootCard } from '@/types/shootCard'
import { useQueryClient } from '@tanstack/react-query'
import { downloadBlob, getHistoryDownloadMode } from './shootHistoryDownloadHelpers';
import { sendShootToEditing } from '@/services/shootEditingDispatch';
import { getShootDownloadAddress } from '@/utils/shootDownloadFilename';
import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/config/env'
import { apiClient, getApiHeaders, getImpersonatedUserId } from '@/services/api'
import { registerShootHistoryRefresh } from '@/realtime/realtimeRefreshBus'
import API_ROUTES from '@/lib/api'
import { buildBrightMlsPublishPayloadWithFallback } from '@/utils/brightMls'
import { deriveFilterOptionsFromShoots, mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms'
import {
  ActiveOperationalTab,
  AvailableTab,
  EMPTY_FILTER_COLLECTION,
  FilterCollections,
  HistoryFiltersState,
  HistoryMeta,
  OperationalFiltersState,
  formatCurrency,
} from '@/components/shoots/history/shootHistoryUtils'
import {
  ShootAction,
  ShootData,
  ShootHistoryRecord,
  ShootHistoryServiceAggregate,
} from '@/types/shoots'
import type { UserData } from '@/types/auth'
import { downloadShootMediaArchive, downloadShootRawFiles } from '@/utils/shootMediaDownload'
import { buildShootPath } from '@/utils/shootPath'
import { filterShootByRole } from './shootHistoryRoleFilter'
import { getShootClientReleaseAccess } from '@/components/shoots/details/shootClientReleaseAccess'
import { useShootHistoryMapGeocoding } from '@/hooks/useShootHistoryMapGeocoding'
import type { ShootHistorySort } from '@/components/shoots/history/shootHistorySorting'
import {
  isShootHistoryPageSize,
  readShootHistoryPageSize,
  writeShootHistoryPageSize,
  type ShootHistoryPageSize,
} from '@/components/shoots/history/shootHistoryPageSize'
import { useShootHistoryCalendarData } from './useShootHistoryCalendarData'
import { useShootHistoryListControls } from './useShootHistoryListControls'
import { calendarRangeParams, type ShootCalendarRange } from './shootHistoryCalendarData'

type ToastFn = (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
type InvoicePayload = Record<string, unknown>
type ApiErrorResponse = { message?: string; error?: string }
type OperationalMeta = { current_page: number; per_page: number; total: number }
type PhotographerOption = { id: string | number; name: string; avatar?: string }
type ShootHistoryRecordWithMls = ShootHistoryRecord & { mls_id?: string | number | null }

const ACTIVE_OPERATIONAL_TABS = ['scheduled', 'completed', 'delivered', 'hold', 'editing', 'edited', 'featured'] as const

const isActiveOperationalTab = (value: AvailableTab): value is ActiveOperationalTab =>
  ACTIVE_OPERATIONAL_TABS.includes(value as ActiveOperationalTab)

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message || error.response?.data?.error || error.message || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

const toPhotographerOption = (value: unknown): PhotographerOption | null => {
  if (!value || typeof value !== 'object') return null

  const photographer = value as { id?: string | number; name?: string; avatar?: string }
  if (photographer.id === undefined || photographer.name === undefined) return null

  return {
    id: photographer.id,
    name: photographer.name,
    avatar: photographer.avatar,
  }
}

export interface UseShootHistoryDataArgs {
  toast: ToastFn
  navigate: (path: string) => void
  role: string | null | undefined
  user: UserData | null | undefined
  activeTab: AvailableTab
  shootSort: ShootHistorySort
  scheduledSubTab?: 'all' | 'requested' | 'scheduled'
  holdSubTab?: 'all' | 'on_hold' | 'cancelled'
  operationalFilters: OperationalFiltersState
  historyFilters: HistoryFiltersState
  viewMode: 'grid' | 'list' | 'map' | 'calendar'
  calendarRange?: ShootCalendarRange
  canViewAllShoots: boolean
  canViewHistory: boolean
  canViewInvoice: boolean
  shouldHideClientDetails: boolean
  isSuperAdmin: boolean
  isAdmin: boolean
  isEditingManager: boolean
  isPhotographer: boolean
  isEditor: boolean
  formatDatePref: (date: Date | string | null | undefined) => string
  formatTime: (value: string) => string
}

const isSalesRepRole = (role: string | null | undefined) => {
  const normalizedRole = String(role ?? '').trim().toLowerCase()

  return ['salesrep', 'rep', 'representative'].includes(normalizedRole)
}

const isClientRole = (role: string | null | undefined) =>
  String(role ?? '').trim().toLowerCase() === 'client'

export function useShootHistoryData({
  toast,
  navigate,
  role,
  user,
  activeTab,
  shootSort,
  scheduledSubTab = 'all',
  holdSubTab = 'all',
  operationalFilters,
  historyFilters,
  viewMode,
  calendarRange,
  canViewAllShoots,
  canViewHistory,
  canViewInvoice,
  shouldHideClientDetails,
  isSuperAdmin,
  isAdmin,
  isEditingManager,
  isPhotographer,
  isEditor,
  formatDatePref,
  formatTime,
}: UseShootHistoryDataArgs) {
  const queryClient = useQueryClient()
  const accessScope = `${user?.id ?? ''}:${role ?? ''}:${getImpersonatedUserId() ?? ''}:${canViewAllShoots}:${shouldHideClientDetails}`
  const accessScopeRef = useRef(accessScope)
  accessScopeRef.current = accessScope
  const loadedOperationalKey = useRef('')
  const loadedHistoryKey = useRef('')

  const operationalScope = `${activeTab}:${activeTab === 'scheduled' ? scheduledSubTab : activeTab === 'hold' ? holdSubTab : 'all'}:${shootSort}`
  const {
    operationalPage, setOperationalPage, operationalPageRef, historyPage, setHistoryPage, historyPageRef,
    debouncedOperationalSearch, debouncedOperationalSearchRef, debouncedHistorySearch, debouncedHistorySearchRef,
    operationalListFiltersKey, historyListFiltersKey,
  } = useShootHistoryListControls(activeTab, operationalScope, operationalFilters, historyFilters)

  const calendarEnabled = Boolean(calendarRange) && (activeTab === 'history'
    ? historyFilters.viewAs === 'calendar' && historyFilters.groupBy === 'shoot'
    : viewMode === 'calendar')
  const calendarOperationalFilters = { ...operationalFilters, search: debouncedOperationalSearch }
  const calendarHistoryFilters = { ...historyFilters, search: debouncedHistorySearch }
  const calendar = useShootHistoryCalendarData({
    enabled: calendarEnabled, activeTab, range: calendarRange, scheduledSubTab,
    operationalFilters: calendarOperationalFilters, historyFilters: calendarHistoryFilters,
    role, user, canViewAllShoots, canViewHistory,
    shouldHideClientDetails, isEditor, filterByRole: filterShootByRole,
  })
  const calendarRef = useRef({ enabled: calendarEnabled, refresh: calendar.refresh })
  calendarRef.current = { enabled: calendarEnabled, refresh: calendar.refresh }
  const [deleteShootId, setDeleteShootId] = useState<string | number | null>(null)
  const [deleteShootTarget, setDeleteShootTarget] = useState<ShootData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [downloadingShootIds, setDownloadingShootIds] = useState<Set<string>>(new Set())
  const downloadingShootIdsRef = useRef(new Set<string>())
  const [operationalData, setOperationalData] = useState<ShootData[]>([])
  const [historyRecords, setHistoryRecords] = useState<ShootHistoryRecord[]>([])
  const [historyAggregates, setHistoryAggregates] = useState<ShootHistoryServiceAggregate[]>([])
  const [historyMeta, setHistoryMeta] = useState<HistoryMeta | null>(null)
  const [pageSize, setPageSize] = useState<ShootHistoryPageSize>(() => readShootHistoryPageSize(user?.id))
  const [operationalMeta, setOperationalMeta] = useState<{ current_page: number; per_page: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [operationalFiltersOpen, setOperationalFiltersOpen] = useState(false)
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false)
  const [operationalOptions, setOperationalOptions] = useState<FilterCollections>(EMPTY_FILTER_COLLECTION)
  const [historyOptions, setHistoryOptions] = useState<FilterCollections>(EMPTY_FILTER_COLLECTION)
  const { geoCache, setGeoCache } = useShootHistoryMapGeocoding({
    activeTab,
    historyFilters,
    historyRecords,
    viewMode: viewMode === 'calendar' ? 'list' : viewMode,
    operationalData,
  })
  const [selectedShoot, setSelectedShoot] = useState<ShootData | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [openDownloadDialog, setOpenDownloadDialog] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false)
  const [bulkShoots, setBulkShoots] = useState<ShootData[]>([])
  const [bulkShootsLoading, setBulkShootsLoading] = useState(false)
  const [approvalModalShoot, setApprovalModalShoot] = useState<ShootData | null>(null)
  const [declineModalShoot, setDeclineModalShoot] = useState<ShootData | null>(null)
  const [editModalShoot, setEditModalShoot] = useState<ShootData | null>(null)
  const [photographers, setPhotographers] = useState<PhotographerOption[]>([])
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoicePayload | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [brightMlsRedirectUrl, setBrightMlsRedirectUrl] = useState<string | null>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const operationalFetchAbortRef = useRef<AbortController | null>(null)
  const historyFetchAbortRef = useRef<AbortController | null>(null)
  const operationalFetchGenerationRef = useRef(0)
  const historyFetchGenerationRef = useRef(0)

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const shootSortRef = useRef(shootSort)
  shootSortRef.current = shootSort
  const scheduledSubTabRef = useRef(scheduledSubTab)
  scheduledSubTabRef.current = scheduledSubTab
  const holdSubTabRef = useRef(holdSubTab)
  holdSubTabRef.current = holdSubTab
  const operationalFiltersRef = useRef(operationalFilters)
  operationalFiltersRef.current = operationalFilters
  const historyFiltersRef = useRef(historyFilters)
  historyFiltersRef.current = historyFilters
  const pageSizeRef = useRef(pageSize)
  pageSizeRef.current = pageSize

  useEffect(() => {
    const next = readShootHistoryPageSize(user?.id)
    pageSizeRef.current = next
    setPageSize(next)
  }, [user?.id])
  const canViewAllShootsRef = useRef(canViewAllShoots)
  canViewAllShootsRef.current = canViewAllShoots
  const roleRef = useRef(role)
  roleRef.current = role
  const userRef = useRef(user)
  userRef.current = user
  const canViewHistoryRef = useRef(canViewHistory)
  canViewHistoryRef.current = canViewHistory
  const shouldHideClientDetailsRef = useRef(shouldHideClientDetails)
  shouldHideClientDetailsRef.current = shouldHideClientDetails
  const isEditorRef = useRef(isEditor)
  isEditorRef.current = isEditor

  useEffect(() => {
    if (!shouldHideClientDetails) return
    setOperationalOptions((prev) => (prev.clients.length ? { ...prev, clients: [] } : prev))
    setHistoryOptions((prev) => (prev.clients.length ? { ...prev, clients: [] } : prev))
  }, [shouldHideClientDetails])

  useEffect(() => {
    if (!(isAdmin || isSuperAdmin || isEditingManager || isSalesRepRole(role))) return
    if (!approvalModalShoot) return
    if (photographers.length) return

    const fetchPhotographers = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token')
        const response = await axios.get(`${API_BASE_URL}/api/photographers`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = response.data?.data || response.data || []
        setPhotographers(
          Array.isArray(data)
            ? data
                .map(toPhotographerOption)
                .filter((photographer): photographer is PhotographerOption => Boolean(photographer))
            : [],
        )
      } catch (error) {
        console.error('Error fetching photographers:', error)
      }
    }

    fetchPhotographers()
  }, [approvalModalShoot, isAdmin, isSuperAdmin, isEditingManager, role, photographers.length])

  useEffect(() => {
    if (deleteShootId === null) {
      setDeleteShootTarget(null)
    }
  }, [deleteShootId])

  const handleDetailDialogToggle = useCallback((open: boolean) => {
    setIsDetailOpen(open)
    if (!open) {
      setOpenDownloadDialog(false)
    }
    if (!open && !isUploadDialogOpen) {
      setSelectedShoot(null)
    }
  }, [isUploadDialogOpen])

  const handleUploadDialogToggle = useCallback((open: boolean) => {
    setIsUploadDialogOpen(open)
    if (!open && !isDetailOpen) {
      setSelectedShoot(null)
    }
  }, [isDetailOpen])

  const handleShootSelect = useCallback((shoot: ShootData) => {
    setSelectedShoot(shoot)
    setOpenDownloadDialog(false)
    setIsDetailOpen(true)
  }, [])

  const handleUploadMedia = useCallback((shoot: ShootData) => {
    setSelectedShoot(shoot)
    setIsUploadDialogOpen(true)
  }, [])

  const loadShootById = useCallback(
    async (shootId: string | number, options: { openDetail?: boolean; quiet?: boolean } = {}) => {
      setDetailLoading(true)
      try {
        const response = await apiClient.get(`/shoots/${shootId}`)
        const payload = response.data?.data ?? response.data
        if (!payload) {
          throw new Error('Shoot not found')
        }
        const mapped = mapShootApiToShootData(payload as Record<string, unknown>)
        setSelectedShoot(mapped)
        if (options.openDetail) {
          setIsDetailOpen(true)
        }
        return mapped
      } catch (error) {
        if (!options.quiet) {
          toast({
            title: 'Unable to load shoot',
            description: 'Please try again.',
            variant: 'destructive',
          })
        }
        return null
      } finally {
        setDetailLoading(false)
      }
    },
    [toast],
  )

  const handleHistoryRecordSelect = useCallback(
    (record: ShootHistoryRecord) => {
      if (!record?.id) {
        toast({
          title: 'Shoot unavailable',
          description: 'This history record is missing a shoot id.',
          variant: 'destructive',
        })
        return
      }
      loadShootById(record.id, { openDetail: true })
    },
    [loadShootById, toast],
  )

  const handleDeleteShoot = useCallback((shoot: ShootData) => {
    setDeleteShootId(shoot.id)
    setDeleteShootTarget(shoot)
  }, [])

  const handleDeleteHistoryRecord = useCallback((record: ShootHistoryRecord) => {
    if (record.id) {
      setDeleteShootId(record.id)
      const matchedShoot =
        (selectedShoot?.id && String(selectedShoot.id) === String(record.id) ? selectedShoot : null) ??
        operationalData.find((shoot) => String(shoot.id) === String(record.id)) ??
        null
      setDeleteShootTarget(matchedShoot)
    }
  }, [selectedShoot, operationalData])

  const handleViewInvoice = useCallback(async (shoot: ShootData | { id: string | number }) => {
    setInvoiceLoading(true)
    try {
      const shootId = 'id' in shoot ? shoot.id : (shoot as ShootData).id
      const response = await apiClient.get(`/shoots/${shootId}/invoice`)
      const invoiceData = response.data?.data || response.data
      if (invoiceData) {
        setSelectedInvoice(invoiceData)
        setInvoiceDialogOpen(true)
      } else {
        toast({
          title: 'Invoice not found',
          description: 'Unable to load invoice for this shoot.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
      toast({
        title: 'Error loading invoice',
        description: getErrorMessage(error, 'Unable to load invoice. Please try again.'),
        variant: 'destructive',
      })
    } finally {
      setInvoiceLoading(false)
    }
  }, [toast])

  const handlePrimaryAction = useCallback((action: ShootAction | undefined, shoot: ShootData) => {
    if (!action) {
      handleShootSelect(shoot)
      return
    }

    switch (action.action) {
      case 'pay':
        navigate(buildShootPath(shoot, { search: 'action=pay' }))
        return
      case 'upload_raw':
      case 'upload_final':
        handleUploadMedia(shoot)
        return
      case 'view_media':
        handleShootSelect(shoot)
        return
      case 'open_workflow':
      case 'assign_editor':
      case 'start_editing':
        navigate(buildShootPath(shoot, { hash: 'workflow' }))
        return
      default:
        handleShootSelect(shoot)
    }
  }, [handleShootSelect, handleUploadMedia, navigate])

  const fetchOperationalData = useCallback(async (force = false) => {
    if (calendarRef.current.enabled) return calendarRef.current.refresh()
    operationalFetchAbortRef.current?.abort()
    const controller = new AbortController()
    operationalFetchAbortRef.current = controller
    const fetchGeneration = ++operationalFetchGenerationRef.current
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const currentTab = activeTabRef.current
    const currentFilters = operationalFiltersRef.current
    const currentPage = operationalPageRef.current
    const currentCanViewAll = canViewAllShootsRef.current
    const currentRole = roleRef.current
    const currentUser = userRef.current
    const currentIsEditor = isEditorRef.current
    const currentHideClient = shouldHideClientDetailsRef.current

    try {
      let backendTab = isActiveOperationalTab(currentTab)
        ? currentTab
        : 'scheduled'

      if (currentIsEditor) {
        if (backendTab === 'editing') {
          backendTab = 'completed'
        } else if (backendTab === 'edited') {
          backendTab = 'delivered'
        } else if (backendTab === 'scheduled') {
          backendTab = 'completed'
        }
      }

      const params: Record<string, unknown> = {
        tab: backendTab,
        sort: shootSortRef.current,
        page: currentPage,
        per_page: pageSizeRef.current,
        include_files: 'false',
        view: 'card',
        include_filters: 'false',
      }
      if (backendTab === 'scheduled' && scheduledSubTabRef.current !== 'all') {
        params.scheduled_status = scheduledSubTabRef.current
      }
      if (backendTab === 'hold' && holdSubTabRef.current !== 'all') {
        params.hold_status = holdSubTabRef.current
      }
      if (debouncedOperationalSearchRef.current) params.search = debouncedOperationalSearchRef.current
      Object.assign(params, shootHistoryPersonParams(currentFilters, currentHideClient))
      if (currentFilters.address) params.address = currentFilters.address
      if (currentFilters.services.length) params.services = currentFilters.services
      if (currentFilters.dateRange !== 'all') {
        if (currentFilters.dateRange === 'custom') {
          if (currentFilters.scheduledStart) params.scheduled_start = currentFilters.scheduledStart
          if (currentFilters.scheduledEnd) params.scheduled_end = currentFilters.scheduledEnd
        } else {
          params.date_range = currentFilters.dateRange
        }
      }

      const scope = accessScopeRef.current
      const queryKey = ['shoot-history', scope, 'operational', params] as const
      const serializedKey = JSON.stringify(queryKey)
      type Payload = { data?: unknown; meta?: Partial<OperationalMeta> & { count?: number; filters?: FilterCollections } }
      const applyPayload = (payload: Payload) => {
      const shoots = Array.isArray(payload.data) ? (payload.data as ShootCard[]) : []
      const mappedShoots = shoots.map(mapShootApiToShootData)
      const roleFilteredShoots = currentCanViewAll
        ? mappedShoots
        : mappedShoots.filter((shoot) => filterShootByRole(shoot, currentRole, currentUser))

      setOperationalData(roleFilteredShoots)

      const meta = payload.meta as (Partial<OperationalMeta> & { count?: number }) | undefined
      if (meta && (meta.current_page !== undefined || meta.total !== undefined || meta.count !== undefined)) {
        setOperationalMeta({
          current_page: meta.current_page ?? currentPage,
          per_page: pageSizeRef.current,
          total: meta.total ?? meta.count ?? 0,
        })
      } else {
        setOperationalMeta({ current_page: currentPage, per_page: pageSizeRef.current, total: 0 })
      }

        loadedOperationalKey.current = serializedKey
      }
      const cached = queryClient.getQueryData<Payload>(queryKey)
      if (cached) applyPayload(cached)
      else if (loadedOperationalKey.current !== serializedKey) setOperationalData([])
      setLoading(!cached && loadedOperationalKey.current !== serializedKey)
      if (force) await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' })
      // Cached queries share a request across callers. Only React Query owns its
      // network signal; the local controller below guards against stale results.
      const payload = await queryClient.fetchQuery<Payload>({
        queryKey, staleTime: 30_000, gcTime: 300_000,
        queryFn: async ({ signal }) => (await apiClient.get('/shoots', {
          params: { ...params, ...(force ? { no_cache: 'true' } : {}) }, signal,
        })).data,
      })
      if (controller.signal.aborted || scope !== accessScopeRef.current || fetchGeneration !== operationalFetchGenerationRef.current) return
      applyPayload(payload)
      if ((payload.meta?.total ?? payload.meta?.count ?? 0) > currentPage * pageSizeRef.current) {
        const nextParams = { ...params, page: currentPage + 1 }
        void queryClient.prefetchQuery({ queryKey: ['shoot-history', scope, 'operational', nextParams], staleTime: 30_000, gcTime: 300_000,
          queryFn: async ({ signal }) => (await apiClient.get('/shoots', { params: nextParams, signal })).data })
      }
      void queryClient.fetchQuery<FilterCollections>({
        queryKey: ['shoot-history', scope, 'filters'], staleTime: 300_000, gcTime: 300_000,
        queryFn: async ({ signal }) => (await apiClient.get('/shoots/filters', { signal })).data.data,
      }).then((filters) => {
        if (!controller.signal.aborted && scope === accessScopeRef.current) setOperationalOptions(currentHideClient ? { ...filters, clients: [] } : filters)
      }).catch(() => undefined)
    } catch (error) {
      if (controller.signal.aborted) return
      if (axios.isAxiosError(error) && (error.code === 'ERR_CANCELED' || error.name === 'CanceledError')) {
        return
      }
      console.error('Error fetching operational data:', error)
      let errorMessage = 'Please try refreshing the page.'

      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = 'Unable to connect to the server. Please check your connection and ensure the backend is running.'
        } else if (error.response) {
          const status = error.response.status
          const data = error.response.data
          if (status === 401 || status === 419) {
            errorMessage = 'Your session has expired. Please log in again.'
          } else if (status === 403) {
            errorMessage = 'You do not have permission to view this data.'
          } else if (status >= 500) {
            errorMessage = data?.message || data?.error || 'Server error occurred. Please try again later.'
          } else {
            errorMessage = data?.message || data?.error || `Request failed with status ${status}.`
          }
        } else {
          errorMessage = error.message || 'An unexpected error occurred.'
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      toast({
        title: 'Unable to load shoots',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
      console.debug('[ShootHistory] operational fetch', {
        tab: activeTabRef.current,
        ms: Math.round(end - start),
      })

      if (operationalFetchAbortRef.current === controller) {
        operationalFetchAbortRef.current = null
        setLoading(false)
      }
    }
  }, [toast, queryClient])

  const fetchBulkShoots = useCallback(async () => {
    if (!(isSuperAdmin || isAdmin || isEditingManager)) return
    setBulkShootsLoading(true)

    try {
      const tabs: Array<'scheduled' | 'completed' | 'delivered' | 'hold'> = ['scheduled', 'completed', 'delivered', 'hold']
      const responses = await Promise.all(
        tabs.map((tab) =>
          apiClient.get('/shoots', {
            params: { tab, page: 1, per_page: 200, include_files: 'false' },
          }),
        ),
      )

      const combined = responses.flatMap((response) => {
        const payload = response.data?.data ?? response.data
        return Array.isArray(payload) ? payload : []
      })

      const mapped = combined.map(mapShootApiToShootData)
      const unique = Array.from(new Map(mapped.map((shoot) => [shoot.id, shoot])).values())
      setBulkShoots(unique)
    } catch (error) {
      console.error('Error fetching bulk shoots:', error)
      toast({
        title: 'Unable to load bulk shoots',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      })
    } finally {
      setBulkShootsLoading(false)
    }
  }, [isAdmin, isSuperAdmin, isEditingManager, toast])

  useEffect(() => {
    if (!isBulkActionsOpen) return
    fetchBulkShoots()
  }, [isBulkActionsOpen, fetchBulkShoots])

  const fetchHistoryData = useCallback(async () => {
    if (calendarRef.current.enabled) return calendarRef.current.refresh()
    if (!canViewHistoryRef.current) {
      setLoading(false)
      return
    }
    historyFetchAbortRef.current?.abort()
    const controller = new AbortController()
    historyFetchAbortRef.current = controller
    const fetchGeneration = ++historyFetchGenerationRef.current
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const currentFilters = historyFiltersRef.current
    const currentPage = historyPageRef.current
    const currentHideClient = shouldHideClientDetailsRef.current

    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        group_by: currentFilters.groupBy,
        page: currentPage,
        per_page: pageSizeRef.current,
        sort: shootSortRef.current,
      }
      if (debouncedHistorySearchRef.current) params.search = debouncedHistorySearchRef.current
      Object.assign(params, shootHistoryPersonParams(currentFilters, currentHideClient))
      if (currentFilters.services.length) params.services = currentFilters.services
      if (currentFilters.dateRange && currentFilters.dateRange !== 'all') {
        if (currentFilters.dateRange === 'custom') {
          if (currentFilters.scheduledStart) params.custom_start = currentFilters.scheduledStart
          if (currentFilters.scheduledEnd) params.custom_end = currentFilters.scheduledEnd
          params.date_range = 'custom'
        } else {
          params.date_range = currentFilters.dateRange
        }
      }
      if (currentFilters.scheduledStart && currentFilters.dateRange !== 'custom') params.scheduled_start = currentFilters.scheduledStart
      if (currentFilters.scheduledEnd && currentFilters.dateRange !== 'custom') params.scheduled_end = currentFilters.scheduledEnd
      if (currentFilters.completedStart) params.completed_start = currentFilters.completedStart
      if (currentFilters.completedEnd) params.completed_end = currentFilters.completedEnd

      const scope = accessScopeRef.current
      const queryKey = ['shoot-history', scope, 'history', params]
      type HistoryPayload = { data?: unknown; meta?: { filters?: FilterCollections; current_page?: number; per_page?: number; total?: number } }
      const applyPayload = (payload: HistoryPayload) => {
      const isServiceGrouping = currentFilters.groupBy === 'services'
      const rows = Array.isArray(payload.data) ? payload.data : []

      if (isServiceGrouping) {
        setHistoryAggregates(rows as ShootHistoryServiceAggregate[])
        setHistoryRecords([])
        setHistoryMeta(null)
      } else {
        setHistoryRecords(rows as ShootHistoryRecord[])
        setHistoryAggregates([])
        setHistoryMeta(
          payload.meta
            ? {
                current_page: payload.meta.current_page ?? 1,
                per_page: pageSizeRef.current,
                total: payload.meta.total ?? 0,
              }
            : null,
        )
      }

      if (payload.meta?.filters) {
        const metaFilters = payload.meta.filters
        setHistoryOptions(currentHideClient ? { ...metaFilters, clients: [] } : metaFilters)
      }
      }
      const cached = queryClient.getQueryData<HistoryPayload>(queryKey)
      if (cached) applyPayload(cached)
      else if (loadedHistoryKey.current !== JSON.stringify(queryKey)) {
        setHistoryRecords([])
        setHistoryAggregates([])
        setHistoryMeta(null)
      }
      setLoading(!cached && loadedHistoryKey.current !== JSON.stringify(queryKey))
      const payload = await queryClient.fetchQuery<HistoryPayload>({ queryKey, staleTime: 30_000, gcTime: 300_000,
        queryFn: async ({ signal }) => (await apiClient.get('/shoots/history', { params, signal })).data })
      if (scope !== accessScopeRef.current || controller.signal.aborted || fetchGeneration !== historyFetchGenerationRef.current) return
      loadedHistoryKey.current = JSON.stringify(queryKey)
      applyPayload(payload)
    } catch (error) {
      if (controller.signal.aborted) return
      if (axios.isAxiosError(error) && (error.code === 'ERR_CANCELED' || error.name === 'CanceledError')) {
        return
      }
      console.error('History fetch error:', error)
      let errorMessage = 'Please try refreshing the page.'

      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          errorMessage = 'Unable to connect to the server. Please check your connection and ensure the backend is running.'
        } else if (error.response) {
          const status = error.response.status
          const data = error.response.data
          if (status === 401 || status === 419) {
            errorMessage = 'Your session has expired. Please log in again.'
          } else if (status === 403) {
            errorMessage = 'You do not have permission to view this data.'
          } else if (status >= 500) {
            errorMessage = data?.message || data?.error || 'Server error occurred. Please try again later.'
          } else {
            errorMessage = data?.message || data?.error || `Request failed with status ${status}.`
          }
        } else {
          errorMessage = error.message || 'An unexpected error occurred.'
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      toast({
        title: 'Unable to load history',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
      console.debug('[ShootHistory] history fetch', {
        ms: Math.round(end - start),
        page: historyPageRef.current,
        groupBy: historyFiltersRef.current.groupBy,
      })

      if (historyFetchAbortRef.current === controller) {
        historyFetchAbortRef.current = null
        setLoading(false)
      }
    }
  }, [toast, queryClient])

  const refreshActiveTabData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['shoot-history', accessScopeRef.current], refetchType: 'none' })
    if (activeTab === 'history') {
      await fetchHistoryData()
    } else {
      await fetchOperationalData(true)
    }
  }, [activeTab, fetchHistoryData, fetchOperationalData, queryClient])

  useEffect(() => registerShootHistoryRefresh(refreshActiveTabData), [refreshActiveTabData])

  useEffect(() => {
    if (calendarEnabled) return
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[ShootHistory] Loading timeout - clearing loading state after 30s')
        setLoading(false)
      }
    }, 30000)

    return () => clearTimeout(timeoutId)
  }, [loading, calendarEnabled])

  useEffect(() => {
    loadedOperationalKey.current = ''
    loadedHistoryKey.current = ''
    setOperationalData([])
    setHistoryRecords([])
    setHistoryAggregates([])
    setOperationalOptions(EMPTY_FILTER_COLLECTION)

  }, [accessScope, queryClient])

  useEffect(() => {
    if (!calendarEnabled && activeTab === 'history' && canViewHistory) {
      fetchHistoryData()
    }
    return () => {
      historyFetchAbortRef.current?.abort()
      historyFetchAbortRef.current = null
    }
  }, [historyPage, pageSize, activeTab, shootSort, canViewHistory, historyListFiltersKey, debouncedHistorySearch, fetchHistoryData, calendarEnabled, accessScope])

  useEffect(() => {
    if (!calendarEnabled && activeTab !== 'history') {
      fetchOperationalData()
    }
    return () => {
      operationalFetchAbortRef.current?.abort()
      operationalFetchAbortRef.current = null
    }
  }, [operationalPage, pageSize, activeTab, scheduledSubTab, holdSubTab, shootSort, operationalListFiltersKey, debouncedOperationalSearch, fetchOperationalData, calendarEnabled, accessScope])

  const handleSendToEditing = useCallback(
    async (shoot: Pick<ShootData, 'id' | 'status' | 'workflowStatus'>) => {
      if (!shoot?.id) return
      try {
        if (!canSendShootToEditing(shoot, role)) {
          throw new Error('Editing managers can send only Scheduled or Uploaded shoots to editing')
        }

        if (!await sendShootToEditing(shoot.id)) return

        toast({
          title: 'Success',
          description: 'Shoot sent to editing',
        })

        await refreshActiveTabData()

        if (selectedShoot?.id && String(selectedShoot.id) === String(shoot.id)) {
          await loadShootById(selectedShoot.id, { openDetail: isDetailOpen, quiet: true })
        }
      } catch (error) {
        console.error('Send to editing error:', error)
        toast({
          title: 'Error',
          description: getErrorMessage(error, 'Failed to send to editing'),
          variant: 'destructive',
        })
      }
    },
    [toast, refreshActiveTabData, selectedShoot, loadShootById, isDetailOpen, role],
  )

  const confirmDeleteShoot = useCallback(async (options?: { deleteMedia?: boolean }) => {
    if (deleteShootId === null) return

    const deleteMedia = options?.deleteMedia === true

    setIsDeleting(true)
    try {
      const response = await apiClient.delete(`/shoots/${deleteShootId}`, {
        data: {
          delete_media: deleteMedia,
        },
      })

      toast({
        title: 'Success',
        description:
          response.data?.message ||
          (deleteMedia
            ? 'Shoot and uploaded media deleted successfully.'
            : 'Shoot deleted from the dashboard. Uploaded media was left in storage.'),
      })

      if (selectedShoot?.id && String(selectedShoot.id) === String(deleteShootId)) {
        setSelectedShoot(null)
        setIsDetailOpen(false)
      }

      const deletedId = String(deleteShootId)
      setOperationalData((prev) => prev.filter((shoot) => String(shoot.id) !== deletedId))

      await refreshActiveTabData()
    } catch (error) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to delete shoot'),
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
      setDeleteShootId(null)
    }
  }, [deleteShootId, toast, selectedShoot, refreshActiveTabData])

  const handleUploadComplete = useCallback(async () => {
    setIsUploadDialogOpen(false)
    await refreshActiveTabData()
    if (selectedShoot?.id) {
      await loadShootById(selectedShoot.id, { openDetail: isDetailOpen, quiet: true })
    }
  }, [refreshActiveTabData, selectedShoot, loadShootById, isDetailOpen])

  const handlePageSizeChange = useCallback((size: ShootHistoryPageSize) => {
    if (!isShootHistoryPageSize(size) || size === pageSizeRef.current) return
    writeShootHistoryPageSize(user?.id, size)
    pageSizeRef.current = size
    setPageSize(size)
    historyPageRef.current = 1
    operationalPageRef.current = 1
    setHistoryPage(1)
    setOperationalPage(1)
  }, [user?.id])

  const handleHistoryPageChange = useCallback((direction: 'prev' | 'next') => {
    if (!historyMeta) return
    const currentPage = historyPage
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) {
      newPage = currentPage - 1
    } else if (direction === 'next') {
      const totalPages = Math.ceil(historyMeta.total / historyMeta.per_page)
      if (currentPage < totalPages) {
        newPage = currentPage + 1
      }
    }

    if (newPage !== currentPage) {
      setHistoryPage(newPage)
    }
  }, [historyMeta, historyPage])

  const handleOperationalPageChange = useCallback((direction: 'prev' | 'next') => {
    if (!operationalMeta) return
    const currentPage = operationalPage
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) {
      newPage = currentPage - 1
    } else if (direction === 'next') {
      const totalPages = Math.ceil(operationalMeta.total / operationalMeta.per_page)
      if (currentPage < totalPages) {
        newPage = currentPage + 1
      }
    }

    if (newPage !== currentPage) {
      setOperationalPage(newPage)
    }
  }, [operationalMeta, operationalPage])

  const buildHistoryParams = useCallback(() => {
    const params: Record<string, unknown> = { group_by: historyFilters.groupBy, page: historyPage, per_page: pageSize, sort: shootSort }
    if (debouncedHistorySearch) params.search = debouncedHistorySearch
    Object.assign(params, shootHistoryPersonParams(historyFilters, shouldHideClientDetails))
    if (historyFilters.services.length) params.services = historyFilters.services
    if (historyFilters.dateRange) {
      if (historyFilters.dateRange === 'custom') {
        if (historyFilters.scheduledStart) params.custom_start = historyFilters.scheduledStart
        if (historyFilters.scheduledEnd) params.custom_end = historyFilters.scheduledEnd
        params.date_range = 'custom'
      } else {
        params.date_range = historyFilters.dateRange
      }
    }
    if (historyFilters.scheduledStart && historyFilters.dateRange !== 'custom') params.scheduled_start = historyFilters.scheduledStart
    if (historyFilters.scheduledEnd && historyFilters.dateRange !== 'custom') params.scheduled_end = historyFilters.scheduledEnd
    if (historyFilters.completedStart) params.completed_start = historyFilters.completedStart
    if (historyFilters.completedEnd) params.completed_end = historyFilters.completedEnd
    if (calendarEnabled && activeTab === 'history' && calendarRange) {
      delete params.date_range
      delete params.custom_start
      delete params.custom_end
      Object.assign(params, calendarRangeParams(calendarRange), { group_by: 'shoot', sort: 'date_asc' })
    }
    return params
  }, [historyFilters, debouncedHistorySearch, historyPage, pageSize, shootSort, shouldHideClientDetails, calendarEnabled, activeTab, calendarRange])

  const handleExportHistory = useCallback(async () => {
    try {
      const response = await apiClient.get('/shoots/history/export', {
        params: buildHistoryParams(),
        responseType: 'blob',
      })
      downloadBlob(`shoot-history-${new Date().toISOString()}.csv`, new Blob([response.data]))
      toast({ title: 'Export started', description: 'Your CSV download should begin shortly.' })
    } catch (error) {
      console.error(error)
      toast({ title: 'Export failed', description: 'Please try again.', variant: 'destructive' })
    }
  }, [buildHistoryParams, toast])

  const handleCopyHistory = useCallback(async () => {
    try {
      const records = calendarEnabled && activeTab === 'history' ? calendar.records : historyRecords
      if (!records.length) {
        toast({ title: 'Nothing to copy', description: 'Run a history search first.' })
        return
      }
      const includeClientDetails = !shouldHideClientDetails
      const headers = isSuperAdmin
        ? includeClientDetails
          ? ['Scheduled Date', 'Completed Date', 'Client', 'Address', 'Total Paid']
          : ['Scheduled Date', 'Completed Date', 'Address', 'Total Paid']
        : includeClientDetails
          ? ['Scheduled Date', 'Completed Date', 'Client', 'Address']
          : ['Scheduled Date', 'Completed Date', 'Address']
      const rows = records.map((record) => {
        const baseRow = [formatDatePref(record.scheduledDate), formatDatePref(record.completedDate || record.scheduledDate)]
        if (includeClientDetails) baseRow.push(record.client?.name ?? '—')
        baseRow.push(record.address?.full ?? '—')
        if (isSuperAdmin) baseRow.push(formatCurrency(record.financials?.totalPaid ?? 0))
        return baseRow
      })
      const csv = [headers, ...rows].map((row) => row.join('\t')).join('\n')
      await navigator.clipboard.writeText(csv)
      toast({ title: 'Copied!', description: 'History rows copied to clipboard.' })
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard permissions denied.', variant: 'destructive' })
    }
  }, [historyRecords, isSuperAdmin, shouldHideClientDetails, toast, formatDatePref, calendarEnabled, activeTab, calendar.records])

  const canDownloadHistoryShoot = useCallback((shoot: ShootData) => {
    const downloadMode = getHistoryDownloadMode(shoot, activeTab)

    if (isClientRole(role)) {
      if (downloadMode !== 'delivered') {
        return false
      }

      return getShootClientReleaseAccess(shoot, true).canClientDownload
    }

    if (downloadMode === 'delivered') {
      return true
    }

    return !isSalesRepRole(role)
  }, [activeTab, role])

  const handleDownloadShoot = useCallback(async (shoot: ShootData, _type: 'full' | 'web') => {
    const shootId = String(shoot.id)
    if (!canDownloadHistoryShoot(shoot) || downloadingShootIdsRef.current.has(shootId)) {
      return
    }

    const downloadMode = getHistoryDownloadMode(shoot, activeTab)

    if (downloadMode === 'delivered' && !isEditor) {
      setSelectedShoot(shoot)
      setOpenDownloadDialog(true)
      setIsDetailOpen(true)
      return
    }

    downloadingShootIdsRef.current.add(shootId)
    setDownloadingShootIds(new Set(downloadingShootIdsRef.current))
    try {
      // Photographers are blocked from editor-download-raw (role middleware).
      // Use the scoped media archive pipeline instead — same path as their
      // shoot-detail "Download RAW" action.
      const result = isPhotographer
        ? await downloadShootMediaArchive({
            shootId: shoot.id,
            type: 'raw',
            size: 'original',
            address: getShootDownloadAddress(shoot),
          })
        : await downloadShootRawFiles({
            shootId: shoot.id,
            address: getShootDownloadAddress(shoot),
          })
      toast({
        title: 'Download started',
        description: ('message' in result && result.message) || 'Raw files downloading now.',
      })
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      downloadingShootIdsRef.current.delete(shootId)
      setDownloadingShootIds(new Set(downloadingShootIdsRef.current))
    }
  }, [activeTab, canDownloadHistoryShoot, isEditor, isPhotographer, toast])

  const handlePublishMls = useCallback(
    async (record: ShootHistoryRecord) => {
      const mlsRecord = record as ShootHistoryRecordWithMls

      if (!record?.id || !mlsRecord.mls_id) {
        toast({
          title: 'Cannot publish',
          description: 'This shoot does not have an MLS ID.',
          variant: 'destructive',
        })
        return
      }
      try {
        const shoot = await loadShootById(record.id, { quiet: true })
        if (!shoot) {
          throw new Error('Shoot not found')
        }

        setBrightMlsRedirectUrl(null)
        const token = localStorage.getItem('authToken') || localStorage.getItem('token')
        const payload = await buildBrightMlsPublishPayloadWithFallback(
          shoot as Partial<ShootData> & Record<string, unknown>,
          token,
        )
        if (payload.photos.length === 0) {
          throw new Error('No images found to send. Please ensure the shoot has completed images.')
        }

        const response = await apiClient.post(API_ROUTES.integrations.brightMls.publish(record.id), payload)

        if (response.data.success) {
          const redirectUrl = response.data.data?.redirect_url || response.data.redirect_url
          setBrightMlsRedirectUrl(redirectUrl || null)

          toast({
            title: 'Manifest Sent',
            description: 'Bright MLS opened in the internal popup. Complete the import there.',
          })

          await fetchHistoryData()
        } else {
          throw new Error(response.data.message || 'Publishing failed')
        }
      } catch (error) {
        toast({
          title: 'Publish failed',
          description: getErrorMessage(error, 'Failed to publish to Bright MLS.'),
          variant: 'destructive',
        })
      }
    },
    [fetchHistoryData, loadShootById, toast],
  )

  return {
    deleteShootId,
    deleteShootTarget,
    setDeleteShootId,
    isDeleting,
    operationalData: calendarEnabled && activeTab !== 'history' ? calendar.shoots : operationalData,
    setOperationalData,
    historyRecords: calendarEnabled && activeTab === 'history' ? calendar.records : historyRecords,
    setHistoryRecords,
    historyAggregates,
    setHistoryAggregates,
    historyMeta: calendarEnabled && activeTab === 'history' ? { current_page: 1, per_page: Math.max(calendar.records.length, 1), total: calendar.records.length } : historyMeta,
    setHistoryMeta,
    historyPage,
    setHistoryPage,
    operationalPage,
    setOperationalPage,
    pageSize,
    handlePageSizeChange,
    operationalMeta: calendarEnabled && activeTab !== 'history' ? { current_page: 1, per_page: Math.max(calendar.shoots.length, 1), total: calendar.shoots.length } : operationalMeta,
    setOperationalMeta,
    loading: calendarEnabled ? calendar.loading : loading,
    calendarShoots: calendarEnabled ? calendar.shoots : [],
    calendarError: calendarEnabled ? calendar.error : null,
    setLoading,
    detailLoading,
    setDetailLoading,
    operationalFiltersOpen,
    setOperationalFiltersOpen,
    historyFiltersOpen,
    setHistoryFiltersOpen,
    operationalOptions: calendarEnabled && activeTab !== 'history' ? calendar.filters : operationalOptions,
    setOperationalOptions,
    historyOptions: calendarEnabled && activeTab === 'history' ? calendar.filters : historyOptions,
    setHistoryOptions,
    geoCache,
    setGeoCache,
    gridContainerRef,
    selectedShoot,
    setSelectedShoot,
    isDetailOpen,
    setIsDetailOpen,
    openDownloadDialog,
    isUploadDialogOpen,
    setIsUploadDialogOpen,
    isBulkActionsOpen,
    setIsBulkActionsOpen,
    bulkShoots,
    setBulkShoots,
    bulkShootsLoading,
    setBulkShootsLoading,
    approvalModalShoot,
    setApprovalModalShoot,
    declineModalShoot,
    setDeclineModalShoot,
    editModalShoot,
    setEditModalShoot,
    photographers,
    setPhotographers,
    invoiceDialogOpen,
    setInvoiceDialogOpen,
    selectedInvoice,
    setSelectedInvoice,
    invoiceLoading,
    setInvoiceLoading,
    brightMlsRedirectUrl,
    setBrightMlsRedirectUrl,
    handleDetailDialogToggle,
    handleUploadDialogToggle,
    handleShootSelect,
    handleUploadMedia,
    loadShootById,
    handleHistoryRecordSelect,
    handleDeleteShoot,
    handleDeleteHistoryRecord,
    handleViewInvoice,
    handlePrimaryAction,
    fetchOperationalData,
    fetchBulkShoots,
    fetchHistoryData,
    refreshActiveTabData,
    handleSendToEditing,
    confirmDeleteShoot,
    handleUploadComplete,
    handleHistoryPageChange,
    handleOperationalPageChange,
    buildHistoryParams,
    handleExportHistory,
    handleCopyHistory,
    handlePublishMls,
    canDownloadHistoryShoot,
    downloadingShootIds,
    handleDownloadShoot,
  }
}
