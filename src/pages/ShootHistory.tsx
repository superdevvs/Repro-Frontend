import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { withErrorBoundary } from '@/components/ui/ErrorBoundary'
import { SharedShootCard } from '@/components/shoots/SharedShootCard'
import { ShootHistoryModalHost } from '@/components/shoots/history/ShootHistoryModalHost'
import { HistoryAggregateCard, HistoryRow } from '@/components/shoots/history/ShootHistoryHistoryRows'
import { CompletedAlbumCard, CompletedShootListRow, HoldOnShootCard, ScheduledShootListRow } from '@/components/shoots/history/ShootHistoryOperationalRows'
import { ShootHistoryView } from '@/components/shoots/history/ShootHistoryView'
import { ShootMapView } from '@/components/shoots/history/ShootHistoryMapView'
import { useShootHistoryFilters } from '@/hooks/useShootHistoryFilters'
import { useShootHistoryData } from '@/hooks/useShootHistoryData'
import { useShootHistoryViewState } from '@/hooks/useShootHistoryViewState'
import { useAuth } from '@/components/auth/AuthProvider'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { Calendar as CalendarIcon, CheckCircle2, PauseCircle, Trash2 } from 'lucide-react'
import { DEFAULT_OPERATIONAL_FILTERS, HISTORY_ALLOWED_ROLES, MapMarker, STATUS_FILTERS_BY_TAB, formatCurrency } from '@/components/shoots/history/shootHistoryUtils'
import { ShootAction, ShootData, ShootFileData, ShootHistoryRecord, ShootHistoryServiceAggregate } from '@/types/shoots'
import { apiClient } from '@/services/api'
import API_ROUTES from '@/lib/api'
import { registerShootHistoryRefresh } from '@/realtime/realtimeRefreshBus'
import { normalizeShootPaymentSummary } from '@/utils/shootPaymentSummary'

const READY_STATUS_KEYS = [
  'ready',
  'ready_for_client',
  'editing_complete',
  'editing_uploaded',
]

const DELIVERED_STATUS_KEYS = [
  'delivered',
  'admin_verified',
  'workflow_completed',
  'client_delivered',
  'finalised',
  'finalized',
]

const ShootHistory: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { role, user } = useAuth()
  const { formatTime, formatDate: formatDatePref } = useUserPreferences()
  
  // Local formatDisplayDate that uses user preference
  const formatDisplayDatePref = (value?: string | null) => {
    if (!value) return '—'
    try {
      return formatDatePref(new Date(value))
    } catch (error) {
      return value
    }
  }
  
  const isSuperAdmin = role === 'superadmin'
  const isEditingManager = role === 'editing_manager'
  const isAdmin = role === 'admin'
  const isPhotographer = role === 'photographer'
  const isEditor = role === 'editor'
  const shouldHideClientDetails = isEditor
  const canViewAllShoots = isSuperAdmin || isAdmin || isEditingManager // Super Admin, Admin, and Editing Manager can see all shoots
  const canViewHistory = HISTORY_ALLOWED_ROLES.has((role as string) ?? '')
  const canViewInvoice = !isPhotographer && !isEditingManager // Hide invoice for photographers and editing managers
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

  const resetOperationalFilters = () => {
    setOperationalFilters(DEFAULT_OPERATIONAL_FILTERS)
  }

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
    setHistoryFilters(defaultHistoryFilters)
  }

  const {
    deleteShootId,
    setDeleteShootId,
    isDeleting,
    operationalData,
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
    setGeoCache,
    selectedShoot,
    isDetailOpen,
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
    fetchOperationalData,
    refreshActiveTabData,
    handleSendToEditing,
    confirmDeleteShoot,
    handleUploadComplete,
    handleHistoryPageChange,
    handleOperationalPageChange,
    handleExportHistory,
    handleCopyHistory,
    handlePublishMls,
    handleDownloadShoot,
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
  })

  // Compute masonry column count from actual container width (accounts for sidebar)
  const getMasonryCols = () => {
    const cw = gridContainerRef.current?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024)
    return cw <= 479 ? 1 : cw <= 719 ? 2 : cw <= 960 ? 3 : 4
  }

  // Filter operational data based on sub-tabs
  const filteredOperationalData = useMemo(() => {
    // Scheduled tab filtering
    if (activeTab === 'scheduled') {
      if (scheduledSubTab === 'all') return operationalData
      if (scheduledSubTab === 'requested') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'requested'
        })
      }
      if (scheduledSubTab === 'scheduled') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'scheduled' || status === 'booked'
        })
      }
      return operationalData
    }
    
    // In-Progress tab filtering
    if (activeTab === 'completed') {
      if (inProgressSubTab === 'all') return operationalData
      if (inProgressSubTab === 'uploaded') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status.includes('uploaded') || status === 'photos_uploaded' || status === 'raw_uploaded'
        })
      }
      if (inProgressSubTab === 'editing') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status.includes('editing') || status === 'start_editing'
        })
      }
      return operationalData
    }
    
    // Delivered tab filtering
    if (activeTab === 'delivered') {
      if (deliveredSubTab === 'all') return operationalData
      if (deliveredSubTab === 'delivered') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return DELIVERED_STATUS_KEYS.includes(status)
        })
      }
      if (deliveredSubTab === 'ready') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return READY_STATUS_KEYS.includes(status)
        })
      }
      return operationalData
    }
    
    // Editor "Editing" tab — backend sends tab=completed, filter to editing-status only
    if (activeTab === 'editing') {
      const allowed = STATUS_FILTERS_BY_TAB['editing']
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return allowed.some(a => status.includes(a))
      })
    }

    // Editor "Edited" tab — backend sends tab=delivered, filter to delivered-status only
    if (activeTab === 'edited') {
      const allowed = STATUS_FILTERS_BY_TAB['edited']
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return allowed.some(a => status.includes(a))
      })
    }

    // Hold tab filtering
    if (activeTab === 'hold') {
      if (holdSubTab === 'all') return operationalData
      if (holdSubTab === 'on_hold') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'on_hold' || status === 'hold_on'
        })
      }
      if (holdSubTab === 'cancelled') {
        return operationalData.filter(s => {
          const status = (s.workflowStatus || s.status || '').toLowerCase()
          return status === 'cancelled' || status === 'canceled'
        })
      }
      return operationalData
    }
    
    return operationalData
  }, [activeTab, scheduledSubTab, inProgressSubTab, deliveredSubTab, holdSubTab, operationalData])

  const operationalMarkers: MapMarker[] = useMemo(() => {
    // Always generate markers for map view, use filtered data for all tabs
    const dataToUse = filteredOperationalData
    return dataToUse
      .map((shoot) => {
        const address = shoot.location.fullAddress
        if (!address) return null
        const coords = geoCache[address]
        if (!coords) return null
        return {
          id: shoot.id,
          title: shouldHideClientDetails ? address : shoot.client.name,
          subtitle: `${formatDisplayDatePref(shoot.scheduledDate)}${shoot.time ? ` · ${formatTime(shoot.time)}` : ''}`,
          address,
          coords,
        }
      })
      .filter(Boolean) as MapMarker[]
  }, [filteredOperationalData, geoCache, shouldHideClientDetails])

  const historyMarkers: MapMarker[] = useMemo(() => {
    if (activeTab !== 'history' || historyFilters.viewAs !== 'map' || historyFilters.groupBy === 'services') {
      return []
    }

    return historyRecords
      .map((record) => {
        const address = record.address?.full
        if (!address) return null
        const coords = geoCache[address]
        if (!coords) return null
        return {
          id: String(record.id),
          title: shouldHideClientDetails ? address : (record.client?.name ?? 'Unknown Client'),
          subtitle: `${formatDisplayDatePref(record.scheduledDate)}${record.completedDate ? ` · Completed ${formatDisplayDatePref(record.completedDate)}` : ''}`,
          address,
          coords,
        }
      })
      .filter(Boolean) as MapMarker[]
  }, [activeTab, historyFilters.viewAs, historyFilters.groupBy, historyRecords, geoCache, shouldHideClientDetails])

  const mapAddresses = useMemo(() => {
    if (activeTab === 'history') {
      if (historyFilters.viewAs !== 'map' || historyFilters.groupBy === 'services') return []
      return historyRecords
        .map((record) => record.address?.full)
        .filter((addr): addr is string => Boolean(addr))
    }

    if (viewMode !== 'map') return []
    return filteredOperationalData
      .map((shoot) => shoot.location.fullAddress)
      .filter((addr): addr is string => Boolean(addr))
  }, [activeTab, historyFilters.viewAs, historyFilters.groupBy, historyRecords, viewMode, filteredOperationalData])

  useEffect(() => {
    if (!mapAddresses.length) return
    const unknownAddresses = mapAddresses.filter((addr) => !geoCache[addr]).slice(0, 6)
    if (!unknownAddresses.length) return

    let cancelled = false

    const geocode = async () => {
      const updates: Record<string, { lat: number; lng: number }> = {}

      for (const address of unknownAddresses) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
            { headers: { Accept: 'application/json' } },
          )
          if (!response.ok) continue
          const data = await response.json()
          const match = data?.[0]
          if (match && !cancelled) {
            updates[address] = {
              lat: parseFloat(match.lat),
              lng: parseFloat(match.lon),
            }
          }
        } catch (error) {
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

  // Scheduled shoots content
  const scheduledContent = useMemo(() => {
    if (loading && activeTab === 'scheduled') {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )
    }

    if (!filteredOperationalData.length) {
      // Determine the message based on sub-tab
      let message = 'No scheduled shoots found'
      let description = 'Try adjusting your filters or book a new shoot.'
      
      if (scheduledSubTab === 'requested') {
        message = 'No requested shoots'
        description = 'Shoots awaiting approval will appear here.'
      } else if (scheduledSubTab === 'scheduled') {
        message = 'No scheduled shoots'
        description = 'Approved and scheduled shoots will appear here.'
      }
      
      return (
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-lg">{message}</p>
          <p className="text-sm mt-1">{description}</p>
        </div>
      )
    }

    if (viewMode === 'grid') {
      // Sort by scheduled date descending so latest shoots come first
      const sortedData = [...filteredOperationalData].sort((a, b) => {
        const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0
        const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0
        return dateB - dateA
      })
      // Distribute items round-robin into columns for masonry with correct L-R order
      const numCols = getMasonryCols()
      const columns: ShootData[][] = Array.from({ length: numCols }, () => [])
      sortedData.forEach((shoot, i) => columns[i % numCols].push(shoot))

      return (
        <div className="masonry-grid">
          {columns.map((colItems, colIdx) => (
            <div key={colIdx} className="masonry-grid-col">
              {colItems.map((shoot) => (
                <SharedShootCard
                  key={shoot.id}
                  shoot={shoot}
                  role={role}
                  onSelect={handleShootSelect}
                  onPrimaryAction={(action) => handlePrimaryAction(action, shoot)}
                  onOpenWorkflow={(selected) => navigate(`/shoots/${selected.id}#workflow`)}
                  onApprove={(s) => setApprovalModalShoot(s)}
                  onDecline={(s) => setDeclineModalShoot(s)}
                  onModify={(s) => setEditModalShoot(s)}
                  onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
                  onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
                  onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
                />
              ))}
            </div>
          ))}
        </div>
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
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onApprove={(s) => setApprovalModalShoot(s)}
            onDecline={(s) => setDeclineModalShoot(s)}
            onModify={(s) => setEditModalShoot(s)}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [loading, activeTab, filteredOperationalData, operationalMeta, viewMode, role, operationalMarkers, handleShootSelect, handlePrimaryAction, navigate, isSuperAdmin, scheduledSubTab, isAdmin, isEditingManager, isEditor, canViewInvoice, canSendToEditing, handleViewInvoice, handleDeleteShoot, handleSendToEditing, shouldHideClientDetails])

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
      return (
        <div className="masonry-grid">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      )
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
          message = 'No ready shoots'
          description = 'Shoots ready for client will appear here.'
        }
      }
      
      return (
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-lg">{message}</p>
          <p className="text-sm mt-1">{description}</p>
        </div>
      )
    }

    if (viewMode === 'grid') {
      const numCols = getMasonryCols()
      const cols: ShootData[][] = Array.from({ length: numCols }, () => [])
      filteredOperationalData.forEach((shoot, i) => cols[i % numCols].push(shoot))

      return (
        <div className="masonry-grid">
          {cols.map((colItems, colIdx) => (
            <div key={colIdx} className="masonry-grid-col">
              {colItems.map((shoot) => (
                <CompletedAlbumCard
                  key={shoot.id}
                  shoot={shoot}
                  onSelect={handleShootSelect}
                  onDownload={handleDownloadShoot}
                  isSuperAdmin={isSuperAdmin}
                  isAdmin={isAdmin}
                  isEditingManager={isEditingManager}
                  isEditor={isEditor}
                  onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
                  onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
                  onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
                  shouldHideClientDetails={shouldHideClientDetails}
                />
              ))}
            </div>
          ))}
        </div>
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
            onDownload={handleDownloadShoot}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [loading, activeTab, filteredOperationalData, operationalMeta, viewMode, operationalMarkers, handleShootSelect, handleDownloadShoot, isSuperAdmin, isAdmin, isEditingManager, isEditor, handleDeleteShoot, handleViewInvoice, handleSendToEditing, inProgressSubTab, deliveredSubTab, canViewInvoice, canSendToEditing, shouldHideClientDetails])

  // Hold-on shoots content
  const holdOnContent = useMemo(() => {
    if (loading && activeTab === 'hold') {
      return (
        <div className="masonry-grid">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )
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
        <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
          <PauseCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-lg">{message}</p>
          <p className="text-sm mt-1">{description}</p>
        </div>
      )
    }

    if (viewMode === 'grid') {
      const numCols = getMasonryCols()
      const cols: ShootData[][] = Array.from({ length: numCols }, () => [])
      filteredOperationalData.forEach((shoot, i) => cols[i % numCols].push(shoot))

      return (
        <div className="masonry-grid">
          {cols.map((colItems, colIdx) => (
            <div key={colIdx} className="masonry-grid-col">
              {colItems.map((shoot) => (
                <HoldOnShootCard 
                  key={shoot.id} 
                  shoot={shoot} 
                  onSelect={handleShootSelect}
                  isSuperAdmin={isSuperAdmin}
                  isAdmin={isAdmin}
                  isEditingManager={isEditingManager}
                  isEditor={isEditor}
                  onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
                  onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
                  onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
                  shouldHideClientDetails={shouldHideClientDetails}
                />
              ))}
            </div>
          ))}
        </div>
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
            isEditingManager={isEditingManager}
            isEditor={isEditor}
            onDelete={isAdmin || isSuperAdmin ? handleDeleteShoot : undefined}
            onViewInvoice={canViewInvoice ? handleViewInvoice : undefined}
            onSendToEditing={canSendToEditing ? handleSendToEditing : undefined}
            shouldHideClientDetails={shouldHideClientDetails}
          />
        ))}
      </div>
    )
  }, [loading, activeTab, filteredOperationalData, operationalMeta, viewMode, operationalMarkers, handleShootSelect, isSuperAdmin, isAdmin, isEditingManager, isEditor, handleDeleteShoot, handleViewInvoice, handleSendToEditing, canViewInvoice, canSendToEditing, shouldHideClientDetails])

  // Legacy operationalContent for backward compatibility
  const operationalContent = useMemo(() => {
    if (activeTab === 'scheduled') return scheduledContent
    if (activeTab === 'completed') return completedContent
    if (activeTab === 'hold') return holdOnContent
    return scheduledContent
  }, [activeTab, scheduledContent, completedContent, holdOnContent])

  const historyContent = useMemo(() => {
    if (!canViewHistory) {
      return (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          You do not have permission to view the history report.
        </div>
      )
    }

    if (loading && activeTab === 'history') {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      )
    }

    if (historyFilters.groupBy === 'services') {
      if (!historyAggregates.length) {
        return (
          <div className="rounded-xl border p-8 text-center text-muted-foreground">
            No aggregates found for the selected filters.
          </div>
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
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          No history records match the current filters.
        </div>
      )
    }

    // Backend already paginates, so render the returned page as-is
    const paginatedRecords = historyRecords

    if (historyFilters.viewAs === 'grid') {
      const numCols = getMasonryCols()
      const histCols: ShootHistoryRecord[][] = Array.from({ length: numCols }, () => [])
      paginatedRecords.forEach((record, i) => histCols[i % numCols].push(record))

      return (
        <div className="masonry-grid">
          {histCols.map((colItems, colIdx) => (
            <div key={colIdx} className="masonry-grid-col">
              {colItems.map((record) => (
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
                        <Badge variant="outline" className="capitalize">
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
            </div>
          ))}
        </div>
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
  }, [canViewHistory, loading, activeTab, historyFilters, historyAggregates, historyRecords, historyMarkers, historyMeta, handleHistoryRecordSelect, handlePublishMls, detailLoading, isSuperAdmin, isAdmin, isEditingManager, isEditor, handleDeleteHistoryRecord, handleViewInvoice, handleSendToEditing, canViewInvoice, canSendToEditing, shouldHideClientDetails])

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
          historyFilters={historyFilters}
          setHistoryFilters={setHistoryFilters}
          operationalFiltersOpen={operationalFiltersOpen}
          setOperationalFiltersOpen={setOperationalFiltersOpen}
          historyFiltersOpen={historyFiltersOpen}
          setHistoryFiltersOpen={setHistoryFiltersOpen}
          fetchOperationalData={fetchOperationalData}
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
          canViewHistory={canViewHistory}
          historyOptions={historyOptions}
          onHistoryFilterChange={onHistoryFilterChange}
          historyServicesSelected={historyServicesSelected}
          defaultHistoryFilters={defaultHistoryFilters}
          resetHistoryFilters={resetHistoryFilters}
          historyMeta={historyMeta}
          handleHistoryPageChange={handleHistoryPageChange}
          historyContent={historyContent}
        />
      </DashboardLayout>
      <ShootHistoryModalHost
        selectedShoot={selectedShoot}
        isDetailOpen={isDetailOpen}
        onDetailClose={() => handleDetailDialogToggle(false)}
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
    </>
  )
}

const ShootHistoryWithBoundary = withErrorBoundary(ShootHistory)

export default ShootHistoryWithBoundary




