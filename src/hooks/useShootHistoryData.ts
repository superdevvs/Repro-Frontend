import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/config/env'
import { apiClient } from '@/services/api'
import { registerShootHistoryRefresh } from '@/realtime/realtimeRefreshBus'
import API_ROUTES from '@/lib/api'
import {
  buildBrightMlsPublishPayloadWithFallback,
} from '@/utils/brightMls'
import {
  deriveFilterOptionsFromShoots,
  mapShootApiToShootData,
} from '@/components/shoots/history/shootHistoryTransforms'
import { normalizeShootDetailsStatus } from '@/components/shoots/modal/shootDetailsCapabilities'
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
import { downloadShootRawFiles } from '@/utils/shootMediaDownload'
import { shootHasEditorAssignment } from '@/utils/shootEditorAssignments'
import { doesShootBelongToClient } from '@/utils/dashboardDerivedUtils'
import { getApiHeaders } from '@/services/api'

type ToastFn = (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
type InvoicePayload = Record<string, unknown>
type ApiErrorResponse = { message?: string; error?: string }
type OperationalMeta = { current_page: number; per_page: number; total: number }
type PhotographerOption = { id: string | number; name: string; avatar?: string }
type ShootHistoryRecordWithMls = ShootHistoryRecord & { mls_id?: string | number | null }

const ACTIVE_OPERATIONAL_TABS = ['scheduled', 'completed', 'delivered', 'hold', 'editing', 'edited'] as const

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
  operationalFilters: OperationalFiltersState
  historyFilters: HistoryFiltersState
  viewMode: 'grid' | 'list' | 'map'
  canViewAllShoots: boolean
  canViewHistory: boolean
  canViewInvoice: boolean
  shouldHideClientDetails: boolean
  isSuperAdmin: boolean
  isAdmin: boolean
  isEditingManager: boolean
  isPhotographer: boolean
  isEditor: boolean
  formatDatePref: (date: Date) => string
  formatTime: (value: string) => string
}

const filterShootByRole = (
  shoot: ShootData,
  role: string | null | undefined,
  user: UserData | null | undefined,
) => {
  if (role === 'client') {
    if (!user?.id && !user?.email && !user?.name) return true
    if (doesShootBelongToClient(shoot, user)) return true

    const userId = user?.id ? String(user.id) : ''
    const userMetadata = (user?.metadata as Record<string, unknown> | undefined) ?? {}
    const scopedClientIds = new Set(
      [
        userMetadata.clientId,
        userMetadata.client_id,
        ...(Array.isArray(userMetadata.clientIds) ? userMetadata.clientIds : []),
        ...(Array.isArray(userMetadata.managedClientIds) ? userMetadata.managedClientIds : []),
      ]
        .map((value) => (value == null ? '' : String(value).trim()))
        .filter(Boolean),
    )

    if (shoot.client?.id && scopedClientIds.has(String(shoot.client.id))) {
      return true
    }

    if (shoot.isGhostVisibleForUser) return true
    return Boolean(userId && (shoot.ghostUserIds ?? []).includes(userId))
  }

  if (role === 'photographer') {
    const userId = user?.id ? String(user.id) : ''
    const photographerId = shoot.photographer?.id ? String(shoot.photographer.id) : ''
    if (userId && photographerId) return userId === photographerId

    const userName = user?.name?.toLowerCase() || ''
    const photographerName = shoot.photographer?.name?.toLowerCase() || ''
    if (!userId && !userName) return true
    return photographerName === userName
  }

  if (role === 'editor') {
    return shootHasEditorAssignment(shoot, user)
  }

  return true
}

const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.parentNode?.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const getHistoryDownloadMode = (
  shoot: ShootData,
  activeTab: AvailableTab,
): 'delivered' | 'raw' => {
  const normalizedStatus = normalizeShootDetailsStatus(
    shoot.workflowStatus || shoot.status,
  )

  if (
    activeTab === 'delivered' ||
    normalizedStatus === 'delivered' ||
    normalizedStatus === 'ready'
  ) {
    return 'delivered'
  }

  return 'raw'
}

const isSalesRepRole = (role: string | null | undefined) => {
  const normalizedRole = String(role ?? '').trim().toLowerCase()

  return ['salesrep', 'rep', 'representative'].includes(normalizedRole)
}

export function useShootHistoryData({
  toast,
  navigate,
  role,
  user,
  activeTab,
  operationalFilters,
  historyFilters,
  viewMode,
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
  const [deleteShootId, setDeleteShootId] = useState<string | number | null>(null)
  const [deleteShootTarget, setDeleteShootTarget] = useState<ShootData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [operationalData, setOperationalData] = useState<ShootData[]>([])
  const [historyRecords, setHistoryRecords] = useState<ShootHistoryRecord[]>([])
  const [historyAggregates, setHistoryAggregates] = useState<ShootHistoryServiceAggregate[]>([])
  const [historyMeta, setHistoryMeta] = useState<HistoryMeta | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [operationalPage, setOperationalPage] = useState(1)
  const [operationalMeta, setOperationalMeta] = useState<{ current_page: number; per_page: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [operationalFiltersOpen, setOperationalFiltersOpen] = useState(false)
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false)
  const [operationalOptions, setOperationalOptions] = useState<FilterCollections>(EMPTY_FILTER_COLLECTION)
  const [historyOptions, setHistoryOptions] = useState<FilterCollections>(EMPTY_FILTER_COLLECTION)
  const [geoCache, setGeoCache] = useState<Record<string, { lat: number; lng: number }>>({})
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

  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const operationalFiltersRef = useRef(operationalFilters)
  operationalFiltersRef.current = operationalFilters
  const operationalPageRef = useRef(operationalPage)
  operationalPageRef.current = operationalPage
  const historyFiltersRef = useRef(historyFilters)
  historyFiltersRef.current = historyFilters
  const historyPageRef = useRef(historyPage)
  historyPageRef.current = historyPage
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
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('shootGeoCache')
      if (stored) {
        setGeoCache(JSON.parse(stored))
      }
    } catch {
      // ignore malformed cache
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('shootGeoCache', JSON.stringify(geoCache))
    } catch {
      // ignore
    }
  }, [geoCache])

  useEffect(() => {
    if (!(isAdmin || isSuperAdmin)) return
    if (!approvalModalShoot) return
    if (photographers.length) return

    const fetchPhotographers = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token')
        const response = await axios.get(`${API_BASE_URL}/api/admin/photographers`, {
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
  }, [approvalModalShoot, isAdmin, isSuperAdmin, photographers.length])

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
        navigate(`/shoots/${shoot.id}?action=pay`)
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
        navigate(`/shoots/${shoot.id}#workflow`)
        return
      default:
        handleShootSelect(shoot)
    }
  }, [handleShootSelect, handleUploadMedia, navigate])

  const fetchOperationalData = useCallback(async () => {
    operationalFetchAbortRef.current?.abort()
    const controller = new AbortController()
    operationalFetchAbortRef.current = controller
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const currentTab = activeTabRef.current
    const currentFilters = operationalFiltersRef.current
    const currentPage = operationalPageRef.current
    const currentCanViewAll = canViewAllShootsRef.current
    const currentRole = roleRef.current
    const currentUser = userRef.current
    const currentIsEditor = isEditorRef.current
    const currentHideClient = shouldHideClientDetailsRef.current

    setLoading(true)
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
        page: currentPage,
        per_page: 12,
        include_files: 'true',
        no_cache: 'true',
      }
      if (currentFilters.search) params.search = currentFilters.search
      if (!currentHideClient && currentFilters.clientId) params.client_id = currentFilters.clientId
      if (currentFilters.photographerId) params.photographer_id = currentFilters.photographerId
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

      const response = await apiClient.get('/shoots', { params, signal: controller.signal })
      const payload = (response.data ?? {}) as { data?: unknown; meta?: { filters?: FilterCollections } }
      const shoots = Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : []
      const mappedShoots = shoots.map(mapShootApiToShootData)
      const roleFilteredShoots = currentCanViewAll
        ? mappedShoots
        : mappedShoots.filter((shoot) => filterShootByRole(shoot, currentRole, currentUser))

      setOperationalData(roleFilteredShoots)

      const meta = payload.meta as (Partial<OperationalMeta> & { count?: number }) | undefined
      if (meta && (meta.current_page !== undefined || meta.total !== undefined || meta.count !== undefined)) {
        setOperationalMeta({
          current_page: meta.current_page ?? currentPage,
          per_page: 12,
          total: meta.total ?? meta.count ?? 0,
        })
      } else {
        setOperationalMeta({ current_page: currentPage, per_page: 12, total: 0 })
      }

      const filtersMeta: FilterCollections = payload.meta?.filters ?? deriveFilterOptionsFromShoots(mappedShoots)
      setOperationalOptions(currentHideClient ? { ...filtersMeta, clients: [] } : filtersMeta)
    } catch (error) {
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
      } else if (!operationalFetchAbortRef.current) {
        setLoading(false)
      }
    }
  }, [toast])

  const fetchBulkShoots = useCallback(async () => {
    if (!(isSuperAdmin || isAdmin || isEditingManager)) return
    setBulkShootsLoading(true)

    try {
      const tabs: Array<'scheduled' | 'completed' | 'delivered' | 'hold'> = ['scheduled', 'completed', 'delivered', 'hold']
      const responses = await Promise.all(
        tabs.map((tab) =>
          apiClient.get('/shoots', {
            params: { tab, page: 1, per_page: 200, include_files: 'true' },
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
    if (!canViewHistoryRef.current) {
      setLoading(false)
      return
    }
    historyFetchAbortRef.current?.abort()
    const controller = new AbortController()
    historyFetchAbortRef.current = controller
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const currentFilters = historyFiltersRef.current
    const currentPage = historyPageRef.current
    const currentHideClient = shouldHideClientDetailsRef.current

    setLoading(true)
    try {
      const params: Record<string, unknown> = { group_by: currentFilters.groupBy, page: currentPage, per_page: 12 }
      if (currentFilters.search) params.search = currentFilters.search
      if (!currentHideClient && currentFilters.clientId) params.client_id = currentFilters.clientId
      if (currentFilters.photographerId) params.photographer_id = currentFilters.photographerId
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

      const response = await apiClient.get('/shoots/history', { params, signal: controller.signal })
      const payload = (response.data ?? {}) as {
        data?: unknown
        meta?: { filters?: FilterCollections; current_page?: number; per_page?: number; total?: number }
      }
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
                per_page: 12,
                total: payload.meta.total ?? 0,
              }
            : null,
        )
      }

      if (payload.meta?.filters) {
        const metaFilters = payload.meta.filters
        setHistoryOptions(currentHideClient ? { ...metaFilters, clients: [] } : metaFilters)
      }
    } catch (error) {
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
      } else if (!historyFetchAbortRef.current) {
        setLoading(false)
      }
    }
  }, [toast])

  const refreshActiveTabData = useCallback(async () => {
    if (activeTab === 'history') {
      await fetchHistoryData()
    } else {
      await fetchOperationalData()
    }
  }, [activeTab, fetchHistoryData, fetchOperationalData])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[ShootHistory] Loading timeout - clearing loading state after 30s')
        setLoading(false)
      }
    }, 30000)

    return () => clearTimeout(timeoutId)
  }, [loading])

  const lastActiveTabRef = useRef(activeTab)
  useEffect(() => {
    const tabChanged = lastActiveTabRef.current !== activeTab
    lastActiveTabRef.current = activeTab

    if (tabChanged) {
      if (activeTab === 'history') {
        setHistoryPage(1)
      } else {
        setOperationalPage(1)
      }
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'history' && canViewHistory) {
      fetchHistoryData()
    }
  }, [historyPage, activeTab, canViewHistory, historyFilters, fetchHistoryData])

  useEffect(() => {
    if (activeTab !== 'history') {
      fetchOperationalData()
    }
  }, [operationalPage, activeTab, operationalFilters, fetchOperationalData])

  const handleSendToEditing = useCallback(
    async (shoot: Pick<ShootData, 'id' | 'status' | 'workflowStatus'>) => {
      if (!shoot?.id) return
      try {
        const currentStatus = shoot.status || shoot.workflowStatus || 'booked'
        if (String(currentStatus).toLowerCase() !== 'uploaded') {
          throw new Error('Shoot must be in Uploaded status before sending to editing')
        }

        await apiClient.post(`/shoots/${shoot.id}/start-editing`)

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
    [toast, refreshActiveTabData, selectedShoot, loadShootById, isDetailOpen],
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
    const params: Record<string, unknown> = { group_by: historyFilters.groupBy, page: historyPage, per_page: 12 }
    if (historyFilters.search) params.search = historyFilters.search
    if (!shouldHideClientDetails && historyFilters.clientId) params.client_id = historyFilters.clientId
    if (historyFilters.photographerId) params.photographer_id = historyFilters.photographerId
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
    return params
  }, [historyFilters, historyPage, shouldHideClientDetails])

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
      if (!historyRecords.length) {
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
      const rows = historyRecords.map((record) => {
        const baseRow = [formatDatePref(new Date(record.scheduledDate)), formatDatePref(new Date(record.completedDate || record.scheduledDate))]
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
  }, [historyRecords, isSuperAdmin, shouldHideClientDetails, toast, formatDatePref])

  const canDownloadHistoryShoot = useCallback((shoot: ShootData) => {
    const downloadMode = getHistoryDownloadMode(shoot, activeTab)

    if (downloadMode === 'delivered') {
      return true
    }

    return !isSalesRepRole(role)
  }, [activeTab, role])

  const handleDownloadShoot = useCallback((shoot: ShootData, _type: 'full' | 'web') => {
    if (!canDownloadHistoryShoot(shoot)) {
      return
    }

    const downloadMode = getHistoryDownloadMode(shoot, activeTab)

    if (downloadMode === 'delivered' && !isEditor) {
      setSelectedShoot(shoot)
      setOpenDownloadDialog(true)
      setIsDetailOpen(true)
      return
    }

    void (async () => {
      try {
        const result = await downloadShootRawFiles({
          shootId: shoot.id,
        })
        toast({
          title: 'Download started',
          description: result.message || 'Raw files downloading now.',
        })
      } catch (error) {
        toast({
          title: 'Download failed',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        })
      }
    })()
  }, [activeTab, canDownloadHistoryShoot, isEditor, toast])

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

  const mapAddresses = useMemo(() => {
    if (activeTab === 'history') {
      if (historyFilters.viewAs !== 'map' || historyFilters.groupBy === 'services') return []
      return historyRecords
        .map((record) => record.address?.full)
        .filter((addr): addr is string => Boolean(addr))
    }

    if (viewMode !== 'map') return []
    return operationalData
      .map((shoot) => shoot.location.fullAddress)
      .filter((addr): addr is string => Boolean(addr))
  }, [activeTab, historyFilters.viewAs, historyFilters.groupBy, historyRecords, viewMode, operationalData])

  useEffect(() => {
    if (!mapAddresses.length) return
    const unknownAddresses = mapAddresses.filter((addr) => !geoCache[addr]).slice(0, 6)
    if (!unknownAddresses.length) return

    let cancelled = false

    const geocode = async () => {
      const updates: Record<string, { lat: number; lng: number }> = {}

      for (const address of unknownAddresses) {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`, {
            headers: { Accept: 'application/json' },
          })
          if (!response.ok) continue
          const data = await response.json()
          const match = data?.[0]
          if (match && !cancelled) {
            updates[address] = { lat: parseFloat(match.lat), lng: parseFloat(match.lon) }
          }
        } catch {
          // ignore
        }
        await new Promise((resolve) => setTimeout(resolve, 450))
      }

      if (!cancelled && Object.keys(updates).length) {
        setGeoCache((prev) => ({ ...prev, ...updates }))
      }
    }

    geocode()

    return () => {
      cancelled = true
    }
  }, [mapAddresses, geoCache])

  return {
    deleteShootId,
    deleteShootTarget,
    setDeleteShootId,
    isDeleting,
    operationalData,
    setOperationalData,
    historyRecords,
    setHistoryRecords,
    historyAggregates,
    setHistoryAggregates,
    historyMeta,
    setHistoryMeta,
    historyPage,
    setHistoryPage,
    operationalPage,
    setOperationalPage,
    operationalMeta,
    setOperationalMeta,
    loading,
    setLoading,
    detailLoading,
    setDetailLoading,
    operationalFiltersOpen,
    setOperationalFiltersOpen,
    historyFiltersOpen,
    setHistoryFiltersOpen,
    operationalOptions,
    setOperationalOptions,
    historyOptions,
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
    handleDownloadShoot,
  }
}
