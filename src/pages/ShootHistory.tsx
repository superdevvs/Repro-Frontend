import { ShootEmptyState } from '@/components/shoots/ShootEmptyState';
import { EmptyState } from '@/components/ui/empty-state';
import { usePageLoading } from '@/hooks/use-page-loading';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StripePaymentDialog } from '@/components/payments/StripePaymentDialog'
import { useToast } from '@/components/ui/use-toast'
import { withErrorBoundary } from '@/components/ui/ErrorBoundary'
import { SharedShootCard } from '@/components/shoots/SharedShootCard'
import { ShootHistoryModalHost } from '@/components/shoots/history/ShootHistoryModalHost'
import { ShootHistoryLoadingPanel } from '@/components/shoots/history/ShootHistoryLoadingPanel'
import { HistoryAggregateCard, HistoryRow } from '@/components/shoots/history/ShootHistoryHistoryRows'
import { CompletedAlbumCard, CompletedShootListRow, HoldOnShootCard, ScheduledShootListRow } from '@/components/shoots/history/ShootHistoryOperationalRows'
import { ShootHistoryView } from '@/components/shoots/history/ShootHistoryView'
import { filterOperationalHistoryShoots } from '@/components/shoots/history/filterOperationalHistoryShoots'
import { ShootHistoryCalendarPanel } from '@/components/shoots/history/ShootHistoryCalendarPanel'
import { useShootHistoryCalendarState } from '@/hooks/useShootHistoryCalendarState'
import { useShootHistoryCalendarFocus } from '@/hooks/useShootHistoryCalendarFocus'
import { ShootHistoryGrid } from '@/components/shoots/history/ShootHistoryGrid'
import { ShootMapView } from '@/components/shoots/history/ShootHistoryMapView'
import { useShootHistoryFilters } from '@/hooks/useShootHistoryFilters'
import { useShootHistoryData } from '@/hooks/useShootHistoryData'
import { useShootHistoryViewState } from '@/hooks/useShootHistoryViewState'
import { useShootHistoryGridColumns } from '@/hooks/useShootHistoryGridColumns'
import { useAuth } from '@/components/auth/AuthProvider'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { API_BASE_URL } from '@/config/env'
import { Calendar as CalendarIcon, CheckCircle2, Trash2 } from 'lucide-react'
import { DEFAULT_OPERATIONAL_FILTERS, HISTORY_ALLOWED_ROLES, MapMarker, formatCurrency, getShootStatusBadgeClass, resolveShootThumbnail } from '@/components/shoots/history/shootHistoryUtils'
import { ShootData, ShootHistoryRecord } from '@/types/shoots'
import { toValidMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'
import {
  getStripeConfirmationFailureMessage,
  isStripeSessionPaymentRecorded,
  type StripeConfirmationResult,
} from '@/utils/stripeConfirmation'
import { buildShootPath } from '@/utils/shootPath'

const normalizeShootServices = (services: unknown): string[] => {
  if (!Array.isArray(services)) {
    return []
  }

  return services
    .map((service) => {
      if (typeof service === 'string') {
        return service
      }

      if (service && typeof service === 'object') {
        const serviceRecord = service as { name?: unknown; label?: unknown }
        if (typeof serviceRecord.name === 'string') {
          return serviceRecord.name
        }
        if (typeof serviceRecord.label === 'string') {
          return serviceRecord.label
        }
      }

      return ''
    })
    .filter((service): service is string => Boolean(service))
}

const ShootHistory: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const handledStripeSessionRef = useRef<string | null>(null)
  const { toast } = useToast()
  const { role, user } = useAuth()
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
  const [paymentShoot, setPaymentShoot] = useState<ShootData | null>(null)
  
  // Local formatDisplayDate that uses user preference. Pass the raw string so
  // the formatter renders the LOCAL calendar day (no UTC round-trip) and the
  // date does not drift across browser timezones.
  const formatDisplayDatePref = useCallback((value?: string | null) => {
    if (!value) return '—'
    try {
      return formatDatePref(value)
    } catch (error) {
      return value
    }
  }, [formatDatePref])
  
  const isSuperAdmin = role === 'superadmin'
  const isEditingManager = role === 'editing_manager'
  const isAdmin = role === 'admin'
  const isClient = role === 'client'
  const isPhotographer = role === 'photographer'
  const isEditor = role === 'editor'
  const shouldHideClientDetails = isEditor
  const canViewAllShoots = isSuperAdmin || isAdmin || isEditingManager // Super Admin, Admin, and Editing Manager can see all shoots
  const canViewHistory = HISTORY_ALLOWED_ROLES.has((role as string) ?? '')
  const canViewInvoice = !isPhotographer && !isEditingManager && !isEditor
  const canSendToEditing = isSuperAdmin || isAdmin || isEditingManager
  
  const {
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
    shootSort,
    setShootSort,
    pinnedTabs,
    setPinnedTabs,
    operationalFilters,
    setOperationalFilters,
    historyFilters,
    setHistoryFilters,
    defaultHistoryFilters,
  } = useShootHistoryFilters({
    role,
    isEditor,
    canViewHistory,
  })

  const calendar = useShootHistoryCalendarState({ activeTab, viewMode, historyFilters, historySubTab })

  const togglePinTab = (tab: (typeof tabList)[number]) => {
    setPinnedTabs((prev) => {
      const next = new Set(prev)
      if (next.has(tab)) {
        next.delete(tab)
      } else {
        next.add(tab)
      }
      return next
    })
  }

  const onOperationalFilterChange = (
    key: keyof typeof operationalFilters,
    value: string | string[] | null | undefined,
  ) => {
    setOperationalFilters((prev) => ({
      ...prev,
      [key]: value ?? (Array.isArray(prev[key]) ? [] : ''),
    }))
  }

  const resetOperationalFilters = useCallback(() => {
    setOperationalFilters(DEFAULT_OPERATIONAL_FILTERS)
  }, [setOperationalFilters])
  const hasOperationalFilters = JSON.stringify(operationalFilters) !== JSON.stringify(DEFAULT_OPERATIONAL_FILTERS)

  const onHistoryFilterChange = (
    key: keyof typeof historyFilters,
    value: string | string[] | null | undefined,
  ) => {
    setHistoryFilters((prev) => ({
      ...prev,
      [key]: value ?? (Array.isArray(prev[key]) ? [] : ''),
    }))
  }

  const resetHistoryFilters = () => {
    setHistoryFilters((previous) => ({ ...defaultHistoryFilters, viewAs: previous.viewAs }))
  }

  const {
    deleteShootId,
    deleteShootTarget,
    setDeleteShootId,
    isDeleting,
    operationalData,
    calendarShoots,
    calendarError,
    historyRecords,
    historyAggregates,
    historyMeta,
    operationalPage,
    operationalMeta,
    loading,
    detailLoading,
    operationalFiltersOpen,
    historyFiltersOpen,
    operationalOptions,
    historyOptions,
    geoCache,
    selectedShoot,
    isDetailOpen,
    openDownloadDialog,
    isUploadDialogOpen,
    isBulkActionsOpen,
    bulkShoots,
    bulkShootsLoading,
    approvalModalShoot,
    declineModalShoot,
    editModalShoot,
    photographers,
    invoiceDialogOpen,
    selectedInvoice,
    invoiceLoading,
    brightMlsRedirectUrl,
    gridContainerRef,
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
    refreshActiveTabData,
    handleSendToEditing,
    confirmDeleteShoot,
    handleUploadComplete,
    handleHistoryPageChange,
    handleOperationalPageChange,
    handleExportHistory,
    handleCopyHistory,
    handlePublishMls,
    canDownloadHistoryShoot,
    handleDownloadShoot,
    downloadingShootIds,
    setApprovalModalShoot,
    setDeclineModalShoot,
    setEditModalShoot,
    setIsBulkActionsOpen,
    setOperationalFiltersOpen,
    setHistoryFiltersOpen,
    setInvoiceDialogOpen,
    setSelectedInvoice,
    setBrightMlsRedirectUrl,
  } = useShootHistoryData({
    toast,
    navigate,
    role,
    user,
    activeTab,
    scheduledSubTab,
    shootSort,
    operationalFilters,
    historyFilters,
    viewMode,
    calendarRange: calendar.range,
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
  })

  const calendarFocus = useShootHistoryCalendarFocus(isDetailOpen)
  usePageLoading(loading && !calendar.active);

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (searchParams.get('payment') !== 'success' || !sessionId) return
    if (handledStripeSessionRef.current === sessionId) return

    handledStripeSessionRef.current = sessionId
    let cancelled = false

    const confirmHostedPayment = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token')
        const response = await fetch(`${API_BASE_URL}/api/payments/stripe-session/confirm`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.message || payload?.error || 'Unable to confirm Stripe payment.')
        }
        if (cancelled) return

        const confirmation = (payload?.data || payload) as StripeConfirmationResult
        if (!isStripeSessionPaymentRecorded(confirmation, sessionId)) {
          throw new Error(getStripeConfirmationFailureMessage(
            confirmation,
            sessionId,
            'Stripe has not confirmed this payment as paid yet.',
          ))
        }

        await refreshActiveTabData()
        toast({
          title: 'Payment successful',
          description: 'Your Stripe payment has been confirmed.',
        })

        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('payment')
        nextParams.delete('session_id')
        setSearchParams(nextParams, { replace: true })
      } catch (error) {
        if (cancelled) return
        toast({
          title: 'Unable to confirm payment',
          description: error instanceof Error ? error.message : 'Please refresh and try again.',
          variant: 'destructive',
        })
      }
    }

    void confirmHostedPayment()
    return () => {
      cancelled = true
    }
  }, [refreshActiveTabData, searchParams, setSearchParams, toast])

  const [gridColumns, setGridColumns] = useState<3 | 4>(4)
  const masonryColumnCount = useShootHistoryGridColumns(gridContainerRef, gridColumns)
  const compactGrid = gridColumns === 3 && masonryColumnCount === 3

  const filteredOperationalData = useMemo(() => filterOperationalHistoryShoots(operationalData, {
    activeTab, scheduledSubTab, inProgressSubTab, deliveredSubTab, holdSubTab,
  }), [activeTab, scheduledSubTab, inProgressSubTab, deliveredSubTab, holdSubTab, operationalData])

  const operationalMarkers: MapMarker[] = useMemo(() => {
    // Always generate markers for map view, use filtered data for all tabs
    const dataToUse = filteredOperationalData
    return dataToUse
      .map((shoot) => {
        const address = shoot.location.fullAddress
        if (!address) return null
        const cachedCoordinates = geoCache[address]
        const coords = toValidMapCoordinates(
          shoot.location.latitude,
          shoot.location.longitude,
        ) ?? toValidMapCoordinates(cachedCoordinates?.lat, cachedCoordinates?.lng)
        if (!coords) return null
        return {
          id: shoot.id,
          title: shouldHideClientDetails ? address : shoot.client.name,
          subtitle: `${formatDisplayDatePref(shoot.scheduledDate)}${shoot.time ? ` · ${formatTime(shoot.time)}` : ''}`,
          address,
          coords,
          imageUrl: resolveShootThumbnail(shoot, 'thumb'),
          status: shoot.workflowStatus || shoot.status,
          onOpen: () => handleShootSelect(shoot),
        }
      })
      .filter(Boolean) as MapMarker[]
  }, [filteredOperationalData, formatDisplayDatePref, formatTime, geoCache, handleShootSelect, shouldHideClientDetails])

  const historyMarkers: MapMarker[] = useMemo(() => {
    if (activeTab !== 'history' || historyFilters.viewAs !== 'map' || historyFilters.groupBy === 'services') {
      return []
    }

    return historyRecords
      .map((record) => {
        const address = record.address?.full
        if (!address) return null
        const cachedCoordinates = geoCache[address]
        const coords = toValidMapCoordinates(
          record.address.latitude,
          record.address.longitude,
        ) ?? toValidMapCoordinates(cachedCoordinates?.lat, cachedCoordinates?.lng)
        if (!coords) return null
        return {
          id: String(record.id),
          title: shouldHideClientDetails ? address : (record.client?.name ?? 'Unknown Client'),
          subtitle: `${formatDisplayDatePref(record.scheduledDate)}${record.completedDate ? ` · Completed ${formatDisplayDatePref(record.completedDate)}` : ''}`,
          address,
          coords,
          status: record.status ?? undefined,
          onOpen: () => handleHistoryRecordSelect(record),
        }
      })
      .filter(Boolean) as MapMarker[]
  }, [activeTab, formatDisplayDatePref, historyFilters.viewAs, historyFilters.groupBy, historyRecords, geoCache, handleHistoryRecordSelect, shouldHideClientDetails])

  const handleOpenPaymentDialog = React.useCallback((shoot: ShootData) => {
    setPaymentShoot(shoot)
  }, [])

  const handleClosePaymentDialog = React.useCallback(() => {
    setPaymentShoot(null)
  }, [])

  const handlePaymentSuccess = React.useCallback(() => {
    refreshActiveTabData()
  }, [refreshActiveTabData])

  const handleApproveFeaturedShoot = React.useCallback(async (shoot: ShootData) => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_featured: true }),
      })

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null)
        const message =
          errorJson?.message ||
          errorJson?.error ||
          (errorJson?.errors ? Object.values(errorJson.errors).flat().join(' ') : null) ||
          `Server ${response.status}`
        throw new Error(message)
      }

      toast({
        title: 'Featured shoot approved',
        description: 'The shoot is now visible as Featured.',
      })
      refreshActiveTabData()
    } catch (error) {
      toast({
        title: 'Unable to approve featured shoot',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }, [refreshActiveTabData, toast])

  // Scheduled shoots content
  const scheduledContent = useMemo(() => {
    if (loading && activeTab === 'scheduled') {
      return <ShootHistoryLoadingPanel />
    }

    if (!filteredOperationalData.length) {
      // Determine the message based on sub-tab
      let message = 'No scheduled shoots found'

      
      if (scheduledSubTab === 'requested') {
        message = 'No requested shoots'

      } else if (scheduledSubTab === 'scheduled') {
        message = 'No scheduled shoots'

      }
      
      return (
        <ShootEmptyState title={message} requested={scheduledSubTab === "requested"} filtered={hasOperationalFilters} onReset={resetOperationalFilters} allowBooking={scheduledSubTab !== "requested"} className="min-h-[300px] rounded-xl border border-dashed" />
      )
    }

    if (viewMode === 'grid') {
      return (
        <ShootHistoryGrid columns={masonryColumnCount}>
          {filteredOperationalData.map((shoot) => (
                <SharedShootCard
                  compact={compactGrid}
                  key={shoot.id}
                  shoot={shoot}
                  role={role}
                  onSelect={handleShootSelect}
                  onPrimaryAction={(action) => handlePrimaryAction(action, shoot)}
                  onOpenWorkflow={(selected) => navigate(buildShootPath(selected, { hash: 'workflow' }))}
                  onApprove={(s) => setApprovalModalShoot(s)}
                  onDecline={(s) => setDeclineModalShoot(s)}
                  onModify={(s) => setEditModalShoot(s)}
                  onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
                  onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
                  onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
                  hideHeroImage
                />
          ))}
        </ShootHistoryGrid>
      )
    }

    if (viewMode === 'map') {
      return <ShootMapView markers={operationalMarkers} />
    }

    return (
      <div className="space-y-3">
        {filteredOperationalData.map((shoot) => (
          <ScheduledShootListRow 
            key={shoot.id} 
            shoot={shoot} 
            onSelect={handleShootSelect} 
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isClient={isClient}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onPayNow={isClient ? handleOpenPaymentDialog : undefined}
            onApprove={(s) => setApprovalModalShoot(s)}
            onDecline={(s) => setDeclineModalShoot(s)}
            onModify={(s) => setEditModalShoot(s)}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
            viewerRole={role}
          />
        ))}
      </div>
    )
  }, [hasOperationalFilters, resetOperationalFilters, loading, activeTab, filteredOperationalData, viewMode, masonryColumnCount, compactGrid, role, operationalMarkers, handleShootSelect, handlePrimaryAction, navigate, isSuperAdmin, scheduledSubTab, isAdmin, isClient, isEditingManager, isEditor, canViewInvoice, canSendToEditing, handleViewInvoice, handleOpenPaymentDialog, handleDeleteShoot, handleSendToEditing, shouldHideClientDetails, setApprovalModalShoot, setDeclineModalShoot, setEditModalShoot])

    // Completed shoots content
  const completedContent = useMemo(() => {
    const isEditedTab = activeTab === 'edited'
    const isDeliveredTab = activeTab === 'delivered'
    const isEditingTab = activeTab === 'editing'
    const label = isDeliveredTab
      ? 'delivered'
      : isEditedTab
        ? 'edited'
        : isEditingTab
          ? 'editing'
          : 'completed'
    
    if (loading && (activeTab === 'completed' || activeTab === 'delivered' || activeTab === 'editing' || activeTab === 'edited')) {
      return <ShootHistoryLoadingPanel />
    }

    if (!filteredOperationalData.length) {
      // Determine the message based on tab and sub-tab
      let message = `No ${label} shoots found`
      let description = isDeliveredTab ? 'Delivered shoots will appear here once they are sent.' : 'Completed shoots will appear here once they are finished.'
      
      if (activeTab === 'editing') {
        message = 'No editing shoots'
        description = 'Shoots currently being edited will appear here.'
      } else if (activeTab === 'edited') {
        message = 'No edited shoots'
        description = 'Finalised shoots will appear here once delivered.'
      } else if (activeTab === 'completed') {
        if (inProgressSubTab === 'uploaded') {
          message = 'No uploaded shoots'
          description = 'Shoots with uploaded photos will appear here.'
        } else if (inProgressSubTab === 'editing') {
          message = 'No editing shoots'
          description = 'Shoots currently being edited will appear here.'
        }
      } else if (activeTab === 'delivered') {
        if (deliveredSubTab === 'delivered') {
          message = 'No delivered shoots'
          description = 'Shoots that have been delivered will appear here.'
        } else if (deliveredSubTab === 'ready') {
          message = 'No shoots awaiting finalize'
          description = 'Ready shoots that still need to be finalized will appear here.'
        }
      }
      
      return (
        <EmptyState icon={hasOperationalFilters ? 'search' : 'completed'} title={hasOperationalFilters ? 'No shoots match these filters' : message} description={hasOperationalFilters ? 'Clear your filters to see more shoots.' : description} action={hasOperationalFilters ? <Button variant="outline" onClick={resetOperationalFilters}>Clear Filters</Button> : undefined} className="min-h-[300px] rounded-xl border border-dashed" />
      )
    }

    if (viewMode === 'grid') {
      return (
        <ShootHistoryGrid columns={masonryColumnCount}>
          {filteredOperationalData.map((shoot) => (
                <CompletedAlbumCard
                  compact={compactGrid}
                  key={shoot.id}
                  shoot={shoot}
                  onSelect={handleShootSelect}
                  onDownload={canDownloadHistoryShoot(shoot) ? handleDownloadShoot : undefined}
                  isDownloading={downloadingShootIds.has(String(shoot.id))}
                  isSuperAdmin={isSuperAdmin}
                  isAdmin={isAdmin}
                  isClient={isClient}
                  showPaymentStatus={isSuperAdmin || isAdmin || isClient}
                  isEditingManager={isEditingManager}
                  isEditor={isEditor}
                  onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
                  onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
                  onPayNow={isClient ? handleOpenPaymentDialog : undefined}
                  onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
                  shouldHideClientDetails={shouldHideClientDetails}
                  viewerRole={role}
                />
          ))}
        </ShootHistoryGrid>
      )
    }

    if (viewMode === 'map') {
      return <ShootMapView markers={operationalMarkers} />
    }

    return (
      <div className="space-y-3">
        {filteredOperationalData.map((shoot) => (
          <CompletedShootListRow
            key={shoot.id}
            shoot={shoot}
            onSelect={handleShootSelect}
            onDownload={canDownloadHistoryShoot(shoot) ? handleDownloadShoot : undefined}
            isDownloading={downloadingShootIds.has(String(shoot.id))}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isClient={isClient}
            showPaymentStatus={isSuperAdmin || isAdmin || isClient}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onPayNow={isClient ? handleOpenPaymentDialog : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
            viewerRole={role}
          />
        ))}
      </div>
    )
  }, [hasOperationalFilters, resetOperationalFilters, loading, activeTab, filteredOperationalData, viewMode, masonryColumnCount, compactGrid, operationalMarkers, handleShootSelect, canDownloadHistoryShoot, handleDownloadShoot, downloadingShootIds, isSuperAdmin, isAdmin, isClient, isEditingManager, isEditor, handleDeleteShoot, handleViewInvoice, handleOpenPaymentDialog, handleSendToEditing, inProgressSubTab, deliveredSubTab, canViewInvoice, canSendToEditing, shouldHideClientDetails, role])

  // Hold-on shoots content
  const holdOnContent = useMemo(() => {
    if (loading && activeTab === 'hold') {
      return <ShootHistoryLoadingPanel />
    }

    if (!filteredOperationalData.length) {
      // Determine the message based on sub-tab
      let message = 'No hold-on shoots'
      let description = 'Shoots awaiting scheduling or payment will appear here.'
      
      if (holdSubTab === 'on_hold') {
        message = 'No on-hold shoots'
        description = 'Shoots that are on hold will appear here.'
      } else if (holdSubTab === 'cancelled') {
        message = 'No cancelled shoots'
        description = 'Cancelled shoots will appear here.'
      }
      
      return (
        <EmptyState icon={hasOperationalFilters ? 'search' : 'requests'} title={hasOperationalFilters ? 'No shoots match these filters' : message} description={hasOperationalFilters ? 'Clear your filters to see more shoots.' : description} action={hasOperationalFilters ? <Button variant="outline" onClick={resetOperationalFilters}>Clear Filters</Button> : undefined} className="min-h-[300px] rounded-xl border border-dashed" />
      )
    }

    if (viewMode === 'grid') {
      return (
        <ShootHistoryGrid columns={masonryColumnCount}>
          {filteredOperationalData.map((shoot) => (
                <HoldOnShootCard
                  compact={compactGrid}
                  key={shoot.id} 
                  shoot={shoot} 
                  onSelect={handleShootSelect}
                  isSuperAdmin={isSuperAdmin}
                  isAdmin={isAdmin}
                  isClient={isClient}
                  isEditingManager={isEditingManager}
                  isEditor={isEditor}
                  onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
                  onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
                  onPayNow={isClient ? handleOpenPaymentDialog : undefined}
                  onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
                  shouldHideClientDetails={shouldHideClientDetails}
                  viewerRole={role}
                />
          ))}
        </ShootHistoryGrid>
      )
    }

    if (viewMode === 'map') {
      return <ShootMapView markers={operationalMarkers} />
    }

    return (
      <div className="space-y-3">
        {filteredOperationalData.map((shoot) => (
          <HoldOnShootCard 
            key={shoot.id} 
            shoot={shoot} 
            onSelect={handleShootSelect}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isClient={isClient}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onPayNow={isClient ? handleOpenPaymentDialog : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
            viewerRole={role}
          />
        ))}
      </div>
    )
  }, [hasOperationalFilters, resetOperationalFilters, loading, activeTab, filteredOperationalData, viewMode, masonryColumnCount, compactGrid, operationalMarkers, handleShootSelect, isSuperAdmin, isAdmin, isClient, isEditingManager, isEditor, handleDeleteShoot, handleViewInvoice, handleOpenPaymentDialog, handleSendToEditing, canViewInvoice, canSendToEditing, shouldHideClientDetails, holdSubTab, role])

  const featuredContent = useMemo(() => {
    if (loading && activeTab === 'featured') {
      return <ShootHistoryLoadingPanel />
    }

    if (!filteredOperationalData.length) {
      return (
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">

          <EmptyState icon="completed" title={<>No featured shoots</>} size="compact" />
          <p className="text-sm mt-1">Shoots marked as Featured will appear here for admins.</p>
        </div>
      )
    }

    if (viewMode === 'grid') {
      return (
        <ShootHistoryGrid columns={masonryColumnCount}>
          {filteredOperationalData.map((shoot) => (
                <CompletedAlbumCard
                  compact={compactGrid}
                  key={shoot.id}
                  shoot={shoot}
                  onSelect={handleShootSelect}
                  onDownload={canDownloadHistoryShoot(shoot) ? handleDownloadShoot : undefined}
                  isDownloading={downloadingShootIds.has(String(shoot.id))}
                  isSuperAdmin={isSuperAdmin}
                  isAdmin={isAdmin}
                  isClient={isClient}
                  showPaymentStatus={isSuperAdmin || isAdmin || isClient}
                  isEditingManager={isEditingManager}
                  isEditor={isEditor}
                  onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
                  onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
                  onPayNow={isClient ? handleOpenPaymentDialog : undefined}
                  onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
                  onApproveFeatured={isAdmin || isSuperAdmin ? handleApproveFeaturedShoot : undefined}
                  shouldHideClientDetails={shouldHideClientDetails}
                  viewerRole={role}
                />
          ))}
        </ShootHistoryGrid>
      )
    }

    if (viewMode === 'map') {
      return <ShootMapView markers={operationalMarkers} />
    }

    return (
      <div className="space-y-3">
        {filteredOperationalData.map((shoot) => (
          <CompletedShootListRow
            key={shoot.id}
            shoot={shoot}
            onSelect={handleShootSelect}
            onDownload={canDownloadHistoryShoot(shoot) ? handleDownloadShoot : undefined}
            isDownloading={downloadingShootIds.has(String(shoot.id))}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isClient={isClient}
            showPaymentStatus={isSuperAdmin || isAdmin || isClient}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onPayNow={isClient ? handleOpenPaymentDialog : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            onApproveFeatured={isAdmin || isSuperAdmin ? handleApproveFeaturedShoot : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
            viewerRole={role}
          />
        ))}
      </div>
    )
  }, [loading, activeTab, filteredOperationalData, viewMode, masonryColumnCount, compactGrid, operationalMarkers, handleShootSelect, canDownloadHistoryShoot, handleDownloadShoot, downloadingShootIds, isSuperAdmin, isAdmin, isClient, isEditingManager, isEditor, handleDeleteShoot, handleViewInvoice, handleOpenPaymentDialog, handleSendToEditing, handleApproveFeaturedShoot, canViewInvoice, canSendToEditing, shouldHideClientDetails, role])

  // Legacy operationalContent for backward compatibility
  const operationalContent = useMemo(() => {
    if (activeTab === 'scheduled') return scheduledContent
    if (activeTab === 'completed') return completedContent
    if (activeTab === 'hold') return holdOnContent
    if (activeTab === 'featured') return featuredContent
    return scheduledContent
  }, [activeTab, scheduledContent, completedContent, holdOnContent, featuredContent])

  const historyContent = useMemo(() => {
    if (!canViewHistory) {
      return (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          You do not have permission to view the history report.
        </div>
      )
    }

    if (loading && activeTab === 'history') {
      return <ShootHistoryLoadingPanel />
    }

    if (historyFilters.groupBy === 'services') {
      if (!historyAggregates.length) {
        return (
          <EmptyState icon="search" title={<>No aggregates found for the selected filters.</>} size="compact" />
        )
      }
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {historyAggregates.map((aggregate) => (
            <HistoryAggregateCard key={aggregate.serviceId} aggregate={aggregate} isSuperAdmin={isSuperAdmin} />
          ))}
        </div>
      )
    }

    if (historyFilters.viewAs === 'map') {
      return <ShootMapView markers={historyMarkers} />
    }

    if (!historyRecords.length) {
      return (
        <EmptyState icon="search" title={<>No history records match the current filters.</>} size="compact" />
      )
    }

    // Backend already paginates, so render the returned page as-is
    const paginatedRecords = historyRecords

    if (historyFilters.viewAs === 'grid') {
      return (
        <ShootHistoryGrid columns={masonryColumnCount}>
          {paginatedRecords.map((record) => (
                <Card key={record.id} className="overflow-hidden border hover:border-primary/40 transition-colors cursor-pointer" onClick={() => handleHistoryRecordSelect(record)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          {shouldHideClientDetails ? 'Shoot' : (record.client?.name ?? 'Unknown Client')}
                        </CardTitle>
                        <CardDescription>
                          {record.address?.full || 'No address'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`capitalize ${getShootStatusBadgeClass(record.status)}`}>
                          {record.status}
                        </Badge>
                        {(isAdmin || isSuperAdmin) && record.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 w-7 p-0 bg-red-500 hover:bg-red-600"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDeleteHistoryRecord(record)
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDisplayDatePref(record.scheduledDate)}</span>
                    </div>
                    {record.completedDate && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span>Completed: {formatDisplayDatePref(record.completedDate)}</span>
                      </div>
                    )}
                    {isSuperAdmin && record.financials && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-semibold">{formatCurrency(record.financials.totalQuote)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
          ))}
        </ShootHistoryGrid>
      )
    }

    // List view (default)
    return (
      <div className="space-y-4">
        {paginatedRecords.map((record) => (
          <HistoryRow 
            key={record.id} 
            record={record} 
            onViewRecord={handleHistoryRecordSelect} 
            onPublishMls={handlePublishMls}
            isBusy={detailLoading}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteHistoryRecord : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [canViewHistory, loading, activeTab, historyFilters, masonryColumnCount, historyAggregates, historyRecords, historyMarkers, handleHistoryRecordSelect, handlePublishMls, detailLoading, isSuperAdmin, isAdmin, isEditingManager, isEditor, handleDeleteHistoryRecord, handleViewInvoice, handleSendToEditing, canViewInvoice, canSendToEditing, shouldHideClientDetails, formatDisplayDatePref])

  const {
    operationalServicesSelected,
    historyServicesSelected,
    tabsConfig,
  } = useShootHistoryViewState({
    role,
    isEditor,
    canViewHistory,
    operationalData,
    historyMeta,
    operationalServicesSelected: operationalFilters.services.length > 0,
    historyServicesSelected: historyFilters.services.length > 0,
  })

  return (
    <>
      <DashboardLayout>
        <ShootHistoryView
          gridContainerRef={gridContainerRef}
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdmin}
          isEditingManager={isEditingManager}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabsConfig={tabsConfig}
          pinnedTabs={pinnedTabs}
          togglePinTab={togglePinTab}
          setIsBulkActionsOpen={setIsBulkActionsOpen}
          viewMode={viewMode}
          setViewMode={setViewMode}
          shootSort={shootSort}
          setShootSort={setShootSort}
          gridColumns={gridColumns}
          setGridColumns={setGridColumns}
          historyFilters={historyFilters}
          setHistoryFilters={setHistoryFilters}
          operationalFiltersOpen={operationalFiltersOpen}
          setOperationalFiltersOpen={setOperationalFiltersOpen}
          historyFiltersOpen={historyFiltersOpen}
          setHistoryFiltersOpen={setHistoryFiltersOpen}
          fetchOperationalData={refreshActiveTabData}
          scheduledSubTab={scheduledSubTab}
          setScheduledSubTab={setScheduledSubTab}
          inProgressSubTab={inProgressSubTab}
          setInProgressSubTab={setInProgressSubTab}
          deliveredSubTab={deliveredSubTab}
          setDeliveredSubTab={setDeliveredSubTab}
          hideDeliveredSubTabs={hideDeliveredSubTabs}
          holdSubTab={holdSubTab}
          setHoldSubTab={setHoldSubTab}
          historySubTab={historySubTab}
          setHistorySubTab={setHistorySubTab}
          operationalFilters={operationalFilters}
          onOperationalFilterChange={onOperationalFilterChange}
          operationalOptions={operationalOptions}
          operationalServicesSelected={operationalServicesSelected}
          resetOperationalFilters={resetOperationalFilters}
          operationalMeta={operationalMeta}
          operationalPage={operationalPage}
          handleOperationalPageChange={handleOperationalPageChange}
          scheduledContent={scheduledContent}
          completedContent={completedContent}
          holdOnContent={holdOnContent}
          featuredContent={featuredContent}
          canViewHistory={canViewHistory}
          historyOptions={historyOptions}
          onHistoryFilterChange={onHistoryFilterChange}
          historyServicesSelected={historyServicesSelected}
          defaultHistoryFilters={defaultHistoryFilters}
          resetHistoryFilters={resetHistoryFilters}
          historyMeta={historyMeta}
          handleHistoryPageChange={handleHistoryPageChange}
          historyContent={historyContent}
          calendarContent={calendar.active && (
            <ShootHistoryCalendarPanel
              shoots={activeTab === 'history' ? calendarShoots : filteredOperationalData}
              view={calendar.view} date={calendar.date}
              onViewChange={calendar.onViewChange} onDateChange={calendar.onDateChange}
              onShootSelect={activeTab === 'history' ? (shoot) => { void loadShootById(shoot.id, { openDetail: true }) } : handleShootSelect}
              loading={loading} error={calendarError} onRetry={refreshActiveTabData}
              hideClientDetails={shouldHideClientDetails}
              canViewPrices={activeTab === 'history' ? isSuperAdmin : canViewInvoice}
              search={activeTab === 'history' ? historyFilters.search : operationalFilters.search}
              photographerId={activeTab === 'history' ? historyFilters.photographerId : operationalFilters.photographerId}
              options={activeTab === 'history' ? historyOptions : operationalOptions}
              onFilterChange={activeTab === 'history' ? onHistoryFilterChange : onOperationalFilterChange}
              showUndatedNotice={activeTab === 'scheduled' && scheduledSubTab !== 'scheduled'}
              onShootClickCapture={calendarFocus.capture}
            />
          )}
        />
      </DashboardLayout>
      <ShootHistoryModalHost
        selectedShoot={selectedShoot}
        isDetailOpen={isDetailOpen}
        openDownloadDialog={openDownloadDialog}
        onDetailClose={() => handleDetailDialogToggle(false)}
        onDetailCloseAutoFocus={calendarFocus.restore}
        onShootUpdate={refreshActiveTabData}
        shouldHideClientDetails={shouldHideClientDetails}
        isSuperAdmin={isSuperAdmin}
        isAdmin={isAdmin}
        isEditingManager={isEditingManager}
        isBulkActionsOpen={isBulkActionsOpen}
        onBulkActionsClose={() => setIsBulkActionsOpen(false)}
        bulkShoots={bulkShoots}
        bulkShootsLoading={bulkShootsLoading}
        approvalModalShoot={approvalModalShoot}
        onApprovalModalClose={() => setApprovalModalShoot(null)}
        onApprovalComplete={() => {
          setApprovalModalShoot(null)
          refreshActiveTabData()
        }}
        declineModalShoot={declineModalShoot}
        onDeclineModalClose={() => setDeclineModalShoot(null)}
        onDeclineComplete={() => {
          setDeclineModalShoot(null)
          refreshActiveTabData()
        }}
        editModalShoot={editModalShoot}
        onEditModalClose={() => setEditModalShoot(null)}
        onEditSaved={() => {
          setEditModalShoot(null)
          refreshActiveTabData()
        }}
        photographers={photographers}
        deleteShootId={deleteShootId}
        deleteShootTarget={deleteShootTarget}
        onDeleteShootIdChange={setDeleteShootId}
        isDeleting={isDeleting}
        onConfirmDelete={confirmDeleteShoot}
        selectedInvoice={selectedInvoice}
        invoiceDialogOpen={invoiceDialogOpen}
        onInvoiceClose={() => {
          setInvoiceDialogOpen(false)
          setSelectedInvoice(null)
        }}
        brightMlsRedirectUrl={brightMlsRedirectUrl}
        onBrightMlsRedirectUrlChange={setBrightMlsRedirectUrl}
      />
      {paymentShoot && (
        <StripePaymentDialog
          isOpen={!!paymentShoot}
          onClose={handleClosePaymentDialog}
          amount={Math.max(
            (paymentShoot.payment?.totalQuote ?? paymentShoot.totalQuote ?? 0) -
              (paymentShoot.payment?.totalPaid ?? paymentShoot.totalPaid ?? 0),
            0,
          )}
          shootId={paymentShoot.id}
          shootAddress={paymentShoot.location?.fullAddress || paymentShoot.location?.address}
          shootServices={normalizeShootServices(paymentShoot.services)}
          shootDate={paymentShoot.scheduledDate}
          shootTime={
            paymentShoot.time && paymentShoot.time !== 'TBD'
              ? formatTime(paymentShoot.time)
              : undefined
          }
          clientName={shouldHideClientDetails ? undefined : paymentShoot.client?.name}
          clientEmail={shouldHideClientDetails ? undefined : paymentShoot.client?.email}
          totalQuote={paymentShoot.payment?.totalQuote ?? paymentShoot.totalQuote}
          totalPaid={paymentShoot.payment?.totalPaid ?? paymentShoot.totalPaid}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </>
  )
}

const ShootHistoryWithBoundary = withErrorBoundary(ShootHistory)

export default ShootHistoryWithBoundary
