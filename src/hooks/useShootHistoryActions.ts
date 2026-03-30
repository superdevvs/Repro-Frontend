import { useCallback, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/config/env'
import API_ROUTES from '@/lib/api'
import { apiClient } from '@/services/api'
import { registerShootHistoryRefresh } from '@/realtime/realtimeRefreshBus'
import { deriveFilterOptionsFromShoots, mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms'
import { downloadShootMediaArchive } from '@/utils/shootMediaDownload'
import {
  buildBrightMlsPublishPayload,
  closePendingBrightMlsWindow,
  navigateBrightMlsWindow,
  openPendingBrightMlsWindow,
} from '@/utils/brightMls'
import {
  FilterCollections,
  HistoryMeta,
  HistoryFiltersState,
  OperationalFiltersState,
  formatCurrency,
} from '@/components/shoots/history/shootHistoryUtils'
import {
  ShootAction,
  ShootData,
  ShootHistoryRecord,
  ShootHistoryServiceAggregate,
} from '@/types/shoots'

type ToastFn = (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
type InvoicePayload = Record<string, unknown>
type ApiErrorResponse = { message?: string; error?: string }
type OperationalMeta = { current_page: number; per_page: number; total: number }
type ShootHistoryRecordWithMls = ShootHistoryRecord & { mls_id?: string | number | null }

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message || error.response?.data?.error || error.message || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}

export interface UseShootHistoryActionsArgs {
  toast: ToastFn
  navigate: (path: string) => void
  role: string | null | undefined
  user: { id?: string | number; email?: string; name?: string } | null | undefined
  activeTab: string
  operationalFilters: OperationalFiltersState
  historyFilters: HistoryFiltersState
  historyPage: number
  operationalPage: number
  canViewAllShoots: boolean
  canViewHistory: boolean
  canViewLinkedAccounts: boolean
  canViewInvoice: boolean
  shouldHideClientDetails: boolean
  isSuperAdmin: boolean
  isAdmin: boolean
  isEditingManager: boolean
  isPhotographer: boolean
  isEditor: boolean
  formatDatePref: (date: Date) => string
  formatTime: (value: string) => string
  parentRefreshActiveTabData: () => Promise<void>
  loadShootById: (shootId: string | number, options?: { openDetail?: boolean; quiet?: boolean }) => Promise<ShootData | null>
  setLoading: (value: boolean) => void
  setDetailLoading: (value: boolean) => void
  setOperationalData: (value: ShootData[] | ((prev: ShootData[]) => ShootData[])) => void
  setHistoryRecords: (value: ShootHistoryRecord[]) => void
  setHistoryAggregates: (value: ShootHistoryServiceAggregate[]) => void
  setHistoryMeta: (value: HistoryMeta | null) => void
  setOperationalMeta: (value: OperationalMeta | null) => void
  setOperationalOptions: (value: FilterCollections) => void
  setHistoryOptions: (value: FilterCollections) => void
  setBulkShoots: (value: ShootData[]) => void
  setBulkShootsLoading: (value: boolean) => void
  deleteShootId: string | number | null
  setDeleteShootId: (value: string | number | null) => void
  setIsDeleting: (value: boolean) => void
  selectedShoot: ShootData | null
  setSelectedShoot: (value: ShootData | null) => void
  isDetailOpen: boolean
  setIsDetailOpen: (value: boolean) => void
  setIsUploadDialogOpen: (value: boolean) => void
  setApprovalModalShoot: (value: ShootData | null) => void
  setDeclineModalShoot: (value: ShootData | null) => void
  setEditModalShoot: (value: ShootData | null) => void
  setInvoiceDialogOpen: (value: boolean) => void
  setSelectedInvoice: (value: InvoicePayload | null) => void
  setInvoiceLoading: (value: boolean) => void
  setBrightMlsRedirectUrl: (value: string | null) => void
  historyRecords: ShootHistoryRecord[]
  historyMeta: HistoryMeta | null
  operationalMeta: OperationalMeta | null
  setHistoryPage: (value: number) => void
  setOperationalPage: (value: number) => void
}

export function useShootHistoryActions(args: UseShootHistoryActionsArgs) {
  const {
    toast,
    navigate,
    role,
    user,
    activeTab,
    operationalFilters,
    historyFilters,
    historyPage,
    operationalPage,
    canViewAllShoots,
    canViewHistory,
    canViewLinkedAccounts,
    canViewInvoice,
    shouldHideClientDetails,
    isSuperAdmin,
    isAdmin,
    isEditingManager,
    isPhotographer,
    isEditor,
    formatDatePref,
    formatTime,
    parentRefreshActiveTabData: _parentRefresh,
    loadShootById,
    setLoading,
    setDetailLoading,
    setOperationalData,
    setHistoryRecords,
    setHistoryAggregates,
    setHistoryMeta,
    setOperationalMeta,
    setOperationalOptions,
    setHistoryOptions,
    setBulkShoots,
    setBulkShootsLoading,
    setDeleteShootId,
    setIsDeleting,
    setSelectedShoot,
    setIsDetailOpen,
    setIsUploadDialogOpen,
    setApprovalModalShoot,
    setDeclineModalShoot,
    setEditModalShoot,
    setInvoiceDialogOpen,
    setSelectedInvoice,
    setInvoiceLoading,
    setBrightMlsRedirectUrl,
    deleteShootId,
    selectedShoot,
    isDetailOpen,
    historyRecords,
    historyMeta,
    operationalMeta,
    setHistoryPage,
    setOperationalPage,
  } = args

  const handleDetailDialogToggle = useCallback((open: boolean) => {
    setIsDetailOpen(open)
  }, [setIsDetailOpen])

  const handleUploadDialogToggle = useCallback((open: boolean) => {
    setIsUploadDialogOpen(open)
  }, [setIsUploadDialogOpen])

  const handleShootSelect = useCallback((shoot: ShootData) => {
    setSelectedShoot(shoot)
    setIsDetailOpen(true)
  }, [setSelectedShoot, setIsDetailOpen])

  const handleUploadMedia = useCallback((shoot: ShootData) => {
    setSelectedShoot(shoot)
    setIsUploadDialogOpen(true)
  }, [setSelectedShoot, setIsUploadDialogOpen])

  const handleDeleteShoot = useCallback((shoot: ShootData) => {
    setDeleteShootId(shoot.id)
  }, [setDeleteShootId])

  const handleDeleteHistoryRecord = useCallback((record: ShootHistoryRecord) => {
    if (record.id) setDeleteShootId(record.id)
  }, [setDeleteShootId])

  const handleViewInvoice = useCallback(async (shoot: ShootData | { id: string | number }) => {
    setInvoiceLoading(true)
    try {
      const shootId = 'id' in shoot ? shoot.id : (shoot as ShootData).id
      const response = await apiClient.get(`/shoots/${shootId}/invoice`)
      const invoiceData = (response.data?.data || response.data) as InvoicePayload | null
      if (invoiceData) {
        setSelectedInvoice(invoiceData)
        setInvoiceDialogOpen(true)
      } else {
        toast({ title: 'Invoice not found', description: 'Unable to load invoice for this shoot.', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error loading invoice', description: getErrorMessage(error, 'Unable to load invoice. Please try again.'), variant: 'destructive' })
    } finally {
      setInvoiceLoading(false)
    }
  }, [setInvoiceLoading, setSelectedInvoice, setInvoiceDialogOpen, toast])

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
    setLoading(true)
    try {
      const params: Record<string, unknown> = { tab: activeTab, page: operationalPage, per_page: 12, include_files: 'true' }
      if (operationalFilters.search) params.search = operationalFilters.search
      if (!shouldHideClientDetails && operationalFilters.clientId) params.client_id = operationalFilters.clientId
      if (operationalFilters.photographerId) params.photographer_id = operationalFilters.photographerId
      if (operationalFilters.address) params.address = operationalFilters.address
      if (operationalFilters.services.length) params.services = operationalFilters.services
      if (operationalFilters.dateRange !== 'all') {
        if (operationalFilters.dateRange === 'custom') {
          if (operationalFilters.scheduledStart) params.scheduled_start = operationalFilters.scheduledStart
          if (operationalFilters.scheduledEnd) params.scheduled_end = operationalFilters.scheduledEnd
        } else {
          params.date_range = operationalFilters.dateRange
        }
      }
      const response = await apiClient.get('/shoots', { params })
      const payload = (response.data ?? {}) as { data?: unknown; meta?: { filters?: FilterCollections } }
      const shoots = Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : []
      const mappedShoots = shoots.map(mapShootApiToShootData)
      const roleFilteredShoots = canViewAllShoots
        ? mappedShoots
        : mappedShoots.filter((shoot) => {
            if (role === 'client') {
              const userId = user?.id ? String(user.id) : ''
              const clientId = shoot.client?.id ? String(shoot.client.id) : ''
              if (userId && clientId) return userId === clientId
              const userEmail = user?.email?.toLowerCase() || ''
              const userName = user?.name?.toLowerCase() || ''
              const shootClientEmail = shoot.client?.email?.toLowerCase() || ''
              const shootClientName = shoot.client?.name?.toLowerCase() || ''
              if (!userId && !userEmail && !userName) return true
              return shootClientEmail === userEmail || shootClientName === userName
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
              const userId = user?.id ? String(user.id) : ''
              const editorId = shoot.editor?.id ? String(shoot.editor.id) : ''
              if (userId && editorId) return userId === editorId
              const userName = user?.name?.toLowerCase() || ''
              const editorName = shoot.editor?.name?.toLowerCase() || ''
              if (!editorId && !editorName) return true
              if (!userId && !userName) return true
              return editorName === userName
            }
            return true
          })
      setOperationalData(roleFilteredShoots)
      const meta = payload.meta as (Partial<OperationalMeta> & { count?: number }) | undefined
      if (meta && (meta.current_page !== undefined || meta.total !== undefined || meta.count !== undefined)) {
        setOperationalMeta({ current_page: meta.current_page ?? operationalPage, per_page: 12, total: meta.total ?? meta.count ?? 0 })
      } else {
        setOperationalMeta({ current_page: operationalPage, per_page: 12, total: 0 })
      }
      const filtersMeta: FilterCollections = payload.meta?.filters ?? deriveFilterOptionsFromShoots(mappedShoots)
      setOperationalOptions(filtersMeta)
    } catch (error) {
      if (axios.isAxiosError(error) && (error.code === 'ERR_CANCELED' || error.name === 'CanceledError')) return
      toast({ title: 'Unable to load shoots', description: 'Please try refreshing the page.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [setLoading, activeTab, operationalPage, operationalFilters, shouldHideClientDetails, canViewAllShoots, role, user, setOperationalData, setOperationalMeta, setOperationalOptions, toast])

  const fetchBulkShoots = useCallback(async () => {
    if (!(isSuperAdmin || isAdmin || isEditingManager)) return
    setBulkShootsLoading(true)
    try {
      const tabs: Array<'scheduled' | 'completed' | 'delivered' | 'hold'> = ['scheduled', 'completed', 'delivered', 'hold']
      const responses = await Promise.all(tabs.map((tab) => apiClient.get('/shoots', { params: { tab, page: 1, per_page: 200, include_files: 'true' } })))
      const combined = responses.flatMap((response) => {
        const payload = response.data?.data ?? response.data
        return Array.isArray(payload) ? payload : []
      })
      const mapped = combined.map(mapShootApiToShootData)
      const unique = Array.from(new Map(mapped.map((shoot) => [shoot.id, shoot])).values())
      setBulkShoots(unique)
    } catch (error) {
      toast({ title: 'Unable to load bulk shoots', description: 'Please try again.', variant: 'destructive' })
    } finally {
      setBulkShootsLoading(false)
    }
  }, [isSuperAdmin, isAdmin, isEditingManager, setBulkShoots, setBulkShootsLoading, toast])

  const fetchHistoryData = useCallback(async () => {
    if (!canViewHistory) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: Record<string, unknown> = { group_by: historyFilters.groupBy, page: historyPage, per_page: 12 }
      if (historyFilters.search) params.search = historyFilters.search
      if (!shouldHideClientDetails && historyFilters.clientId) params.client_id = historyFilters.clientId
      if (historyFilters.photographerId) params.photographer_id = historyFilters.photographerId
      if (historyFilters.services.length) params.services = historyFilters.services
      if (historyFilters.dateRange && historyFilters.dateRange !== 'all') {
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

      const response = await apiClient.get('/shoots/history', { params })
      const payload = (response.data ?? {}) as {
        data?: unknown
        meta?: { filters?: FilterCollections; current_page?: number; per_page?: number; total?: number }
      }
      const isServiceGrouping = historyFilters.groupBy === 'services'
      const rows = Array.isArray(payload.data) ? payload.data : []
      if (isServiceGrouping) {
        setHistoryAggregates(rows as ShootHistoryServiceAggregate[])
        setHistoryRecords([])
        setHistoryMeta(null)
      } else {
        setHistoryRecords(rows as ShootHistoryRecord[])
        setHistoryAggregates([])
        setHistoryMeta(payload.meta ? { current_page: payload.meta.current_page ?? 1, per_page: 12, total: payload.meta.total ?? 0 } : null)
      }
      if (payload.meta?.filters) {
        setHistoryOptions(payload.meta.filters)
      }
    } finally {
      setLoading(false)
    }
  }, [canViewHistory, historyFilters, historyPage, shouldHideClientDetails, setLoading, setHistoryAggregates, setHistoryRecords, setHistoryMeta, setHistoryOptions])

  const refreshActiveTabData = useCallback(async () => {
    if (activeTab === 'history') await fetchHistoryData()
    else await fetchOperationalData()
  }, [activeTab, fetchHistoryData, fetchOperationalData])

  useEffect(() => {
    if (!canViewHistory) return
    return registerShootHistoryRefresh(refreshActiveTabData)
  }, [refreshActiveTabData, canViewHistory])

  const handlePublishMls = useCallback(async (record: ShootHistoryRecord) => {
    const mlsRecord = record as ShootHistoryRecordWithMls
    if (!record?.id || !mlsRecord.mls_id) {
      toast({ title: 'Cannot publish', description: 'This shoot does not have an MLS ID.', variant: 'destructive' })
      return
    }
    let pendingWindow: Window | null = null
    try {
      const shoot = await loadShootById(record.id, { quiet: true })
      if (!shoot) throw new Error('Shoot not found')
      setBrightMlsRedirectUrl(null)
      const payload = buildBrightMlsPublishPayload(shoot as ShootData & Record<string, unknown>)
      if (payload.photos.length === 0) {
        throw new Error('No images found to send. Please ensure the shoot has completed images.')
      }

      pendingWindow = openPendingBrightMlsWindow()

      const response = await apiClient.post(API_ROUTES.integrations.brightMls.publish(record.id), payload)
      if (response.data.success) {
        const redirectUrl = response.data.data?.redirect_url || response.data.redirect_url
        const openedInBrowser = navigateBrightMlsWindow(pendingWindow, redirectUrl)
        if (!openedInBrowser) {
          closePendingBrightMlsWindow(pendingWindow)
          setBrightMlsRedirectUrl(redirectUrl || null)
        }
        toast({
          title: 'Manifest Sent',
          description: openedInBrowser
            ? 'Bright MLS opened in a new tab. Complete the import there.'
            : 'Complete the import by opening Bright MLS from the dialog.',
        })
        await fetchHistoryData()
      } else {
        throw new Error(response.data.message || 'Publishing failed')
      }
    } catch (error) {
      closePendingBrightMlsWindow(pendingWindow)
      toast({ title: 'Publish failed', description: getErrorMessage(error, 'Failed to publish to Bright MLS.'), variant: 'destructive' })
    }
  }, [loadShootById, toast, fetchHistoryData, setBrightMlsRedirectUrl])

  const handleSendToEditing = useCallback(async (shoot: ShootData) => {
    if (!shoot?.id) return
    try {
      const currentStatus = shoot.status || shoot.workflowStatus || 'booked'
      if (String(currentStatus).toLowerCase() !== 'uploaded') {
        throw new Error('Shoot must be in Uploaded status before sending to editing')
      }

      await apiClient.post(`/shoots/${shoot.id}/start-editing`)
      toast({ title: 'Success', description: 'Shoot sent to editing' })
      await refreshActiveTabData()

      if (selectedShoot?.id && String(selectedShoot.id) === String(shoot.id)) {
        await loadShootById(selectedShoot.id, { openDetail: isDetailOpen, quiet: true })
      }
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to send to editing'), variant: 'destructive' })
    }
  }, [toast, refreshActiveTabData, selectedShoot, loadShootById, isDetailOpen])

  const confirmDeleteShoot = useCallback(async () => {
    if (!deleteShootId && deleteShootId !== 0) return

    setIsDeleting(true)
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/shoots/${deleteShootId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({ message: 'Failed to delete shoot' }))) as ApiErrorResponse
        throw new Error(errorData.message || 'Failed to delete shoot')
      }

      toast({ title: 'Success', description: 'Shoot deleted successfully' })

      if (selectedShoot?.id && String(selectedShoot.id) === String(deleteShootId)) {
        setSelectedShoot(null)
        setIsDetailOpen(false)
      }

      const deletedId = String(deleteShootId)
      setOperationalData((prev) => prev.filter((shoot) => String(shoot.id) !== deletedId))
      await refreshActiveTabData()
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to delete shoot'), variant: 'destructive' })
    } finally {
      setIsDeleting(false)
      setDeleteShootId(null)
    }
  }, [deleteShootId, setIsDeleting, toast, selectedShoot, setSelectedShoot, setIsDetailOpen, setOperationalData, refreshActiveTabData, setDeleteShootId])

  const handleUploadComplete = useCallback(async () => {
    setIsUploadDialogOpen(false)
    await refreshActiveTabData()
    if (selectedShoot?.id) {
      await loadShootById(selectedShoot.id, { openDetail: isDetailOpen, quiet: true })
    }
  }, [refreshActiveTabData, loadShootById, setIsUploadDialogOpen, selectedShoot, isDetailOpen])

  const handleHistoryPageChange = useCallback((direction: 'prev' | 'next') => {
    if (!historyMeta) return
    const currentPage = historyPage
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) newPage = currentPage - 1
    else if (direction === 'next') {
      const totalPages = Math.ceil(historyMeta.total / historyMeta.per_page)
      if (currentPage < totalPages) newPage = currentPage + 1
    }
    if (newPage !== currentPage) setHistoryPage(newPage)
  }, [historyMeta, historyPage, setHistoryPage])

  const handleOperationalPageChange = useCallback((direction: 'prev' | 'next') => {
    if (!operationalMeta) return
    const currentPage = operationalPage
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) newPage = currentPage - 1
    else if (direction === 'next') {
      const totalPages = Math.ceil(operationalMeta.total / operationalMeta.per_page)
      if (currentPage < totalPages) newPage = currentPage + 1
    }
    if (newPage !== currentPage) setOperationalPage(newPage)
  }, [operationalMeta, operationalPage, setOperationalPage])

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
      const response = await apiClient.get('/shoots/history/export', { params: buildHistoryParams(), responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `shoot-history-${new Date().toISOString()}.csv`)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast({ title: 'Export started', description: 'Your CSV download should begin shortly.' })
    } catch (error) {
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
        ? includeClientDetails ? ['Scheduled Date', 'Completed Date', 'Client', 'Address', 'Total Paid'] : ['Scheduled Date', 'Completed Date', 'Address', 'Total Paid']
        : includeClientDetails ? ['Scheduled Date', 'Completed Date', 'Client', 'Address'] : ['Scheduled Date', 'Completed Date', 'Address']
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
    } catch (error) {
      toast({ title: 'Copy failed', description: 'Clipboard permissions denied.', variant: 'destructive' })
    }
  }, [historyRecords, isSuperAdmin, shouldHideClientDetails, toast, formatDatePref])

  const handleDownloadShoot = useCallback(async (shoot: ShootData, type: 'full' | 'web') => {
    try {
      toast({ title: 'Preparing download...', description: `Generating ${type === 'full' ? 'full size' : 'web size'} archive.` })
      await downloadShootMediaArchive({
        shootId: shoot.id,
        type: type === 'full' ? 'raw' : 'edited',
        address: shoot.location?.address,
      })
      toast({ title: 'Download started', description: 'Your download should begin shortly.' })
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }, [toast])

  return {
    handleDetailDialogToggle,
    handleUploadDialogToggle,
    handleShootSelect,
    handleUploadMedia,
    handleDeleteShoot,
    handleDeleteHistoryRecord,
    handleViewInvoice,
    handlePrimaryAction,
    fetchOperationalData,
    fetchBulkShoots,
    fetchHistoryData,
    handlePublishMls,
    refreshActiveTabData,
    handleSendToEditing,
    confirmDeleteShoot,
    handleUploadComplete,
    handleHistoryPageChange,
    handleOperationalPageChange,
    buildHistoryParams,
    handleExportHistory,
    handleCopyHistory,
    handleDownloadShoot,
  }
}
