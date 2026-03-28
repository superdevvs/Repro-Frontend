import { useCallback } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/config/env'
import API_ROUTES from '@/lib/api'
import { apiClient } from '@/services/api'
import { registerShootHistoryRefresh } from '@/realtime/realtimeRefreshBus'
import { deriveFilterOptionsFromShoots, mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms'
import { downloadShootMediaArchive } from '@/utils/shootMediaDownload'
import {
  FilterCollections,
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

export interface UseShootHistoryActionsArgs {
  toast: any
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
  refreshActiveTabData: () => Promise<void>
  loadShootById: (shootId: string | number, options?: { openDetail?: boolean; quiet?: boolean }) => Promise<ShootData | null>
  setLoading: (value: boolean) => void
  setDetailLoading: (value: boolean) => void
  setOperationalData: (value: ShootData[] | ((prev: ShootData[]) => ShootData[])) => void
  setHistoryRecords: (value: ShootHistoryRecord[]) => void
  setHistoryAggregates: (value: ShootHistoryServiceAggregate[]) => void
  setHistoryMeta: (value: any) => void
  setOperationalMeta: (value: { current_page: number; per_page: number; total: number } | null) => void
  setOperationalOptions: (value: FilterCollections) => void
  setHistoryOptions: (value: FilterCollections) => void
  setBulkShoots: (value: ShootData[]) => void
  setBulkShootsLoading: (value: boolean) => void
  setDeleteShootId: (value: string | number | null) => void
  setIsDeleting: (value: boolean) => void
  setSelectedShoot: (value: ShootData | null) => void
  setIsDetailOpen: (value: boolean) => void
  setIsUploadDialogOpen: (value: boolean) => void
  setApprovalModalShoot: (value: ShootData | null) => void
  setDeclineModalShoot: (value: ShootData | null) => void
  setEditModalShoot: (value: ShootData | null) => void
  setInvoiceDialogOpen: (value: boolean) => void
  setSelectedInvoice: (value: any) => void
  setInvoiceLoading: (value: boolean) => void
  setBrightMlsRedirectUrl: (value: string | null) => void
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
    refreshActiveTabData,
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
      const invoiceData = response.data?.data || response.data
      if (invoiceData) {
        setSelectedInvoice(invoiceData)
        setInvoiceDialogOpen(true)
      } else {
        toast({ title: 'Invoice not found', description: 'Unable to load invoice for this shoot.', variant: 'destructive' })
      }
    } catch (error: any) {
      toast({ title: 'Error loading invoice', description: error.response?.data?.message || 'Unable to load invoice. Please try again.', variant: 'destructive' })
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
      const meta = payload.meta as any
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
    if (!record?.id || !(record as any).mls_id) {
      toast({ title: 'Cannot publish', description: 'This shoot does not have an MLS ID.', variant: 'destructive' })
      return
    }
    try {
      const shoot = await loadShootById(record.id, { quiet: true })
      if (!shoot) throw new Error('Shoot not found')
      const photos = (shoot.files || []).filter((f: any) => f.path || f.url).map((f: any) => ({ id: f.id, url: f.path || f.url || '', filename: f.filename || `photo-${f.id}`, selected: true }))
      const response = await apiClient.post(API_ROUTES.integrations.brightMls.publish(record.id), {
        photos,
        iguide_tour_url: (shoot as any).iguide_tour_url,
        documents: ((shoot as any).iguide_floorplans || []).map((fp: any) => ({ url: fp.url || fp, filename: fp.filename || 'floorplan.pdf', visibility: 'private' })),
      })
      if (response.data.success) {
        const redirectUrl = response.data.data?.redirect_url || response.data.redirect_url
        if (redirectUrl) setBrightMlsRedirectUrl(redirectUrl)
        toast({ title: 'Manifest Sent', description: 'Complete the import by logging in to Bright MLS.' })
        await fetchHistoryData()
      } else {
        throw new Error(response.data.message || 'Publishing failed')
      }
    } catch (error: any) {
      toast({ title: 'Publish failed', description: error.response?.data?.message || error.message || 'Failed to publish to Bright MLS.', variant: 'destructive' })
    }
  }, [loadShootById, toast, fetchHistoryData, setBrightMlsRedirectUrl])

  const confirmDeleteShoot = useCallback(async () => {
    if (!args?.deleteShootId && args.deleteShootId !== 0) return
  }, [])

  const handleUploadComplete = useCallback(async () => {
    setIsUploadDialogOpen(false)
    await refreshActiveTabData()
    if (args.selectedShoot?.id) {
      await loadShootById(args.selectedShoot.id, { openDetail: args.isDetailOpen, quiet: true })
    }
  }, [refreshActiveTabData, loadShootById, setIsUploadDialogOpen, args?.selectedShoot, args?.isDetailOpen])

  const handleHistoryPageChange = useCallback((direction: 'prev' | 'next') => {
    if (!args.historyMeta) return
    const currentPage = historyPage
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) newPage = currentPage - 1
    else if (direction === 'next') {
      const totalPages = Math.ceil(args.historyMeta.total / args.historyMeta.per_page)
      if (currentPage < totalPages) newPage = currentPage + 1
    }
    if (newPage !== currentPage) args.setHistoryPage(newPage)
  }, [args?.historyMeta, historyPage, args?.setHistoryPage])

  const handleOperationalPageChange = useCallback((direction: 'prev' | 'next') => {
    if (!args.operationalMeta) return
    const currentPage = operationalPage
    let newPage = currentPage
    if (direction === 'prev' && currentPage > 1) newPage = currentPage - 1
    else if (direction === 'next') {
      const totalPages = Math.ceil(args.operationalMeta.total / args.operationalMeta.per_page)
      if (currentPage < totalPages) newPage = currentPage + 1
    }
    if (newPage !== currentPage) args.setOperationalPage(newPage)
  }, [args?.operationalMeta, operationalPage, args?.setOperationalPage])

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
      if (!args.historyRecords.length) {
        toast({ title: 'Nothing to copy', description: 'Run a history search first.' })
        return
      }
      const includeClientDetails = !shouldHideClientDetails
      const headers = isSuperAdmin
        ? includeClientDetails ? ['Scheduled Date', 'Completed Date', 'Client', 'Address', 'Total Paid'] : ['Scheduled Date', 'Completed Date', 'Address', 'Total Paid']
        : includeClientDetails ? ['Scheduled Date', 'Completed Date', 'Client', 'Address'] : ['Scheduled Date', 'Completed Date', 'Address']
      const rows = args.historyRecords.map((record) => {
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
  }, [args?.historyRecords, isSuperAdmin, shouldHideClientDetails, toast, formatDatePref])

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
