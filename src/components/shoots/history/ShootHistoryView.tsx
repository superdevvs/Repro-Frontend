import { EmptyState } from '@/components/ui/empty-state';
import { DASHBOARD_COMPACT_PAGE_X_CLASS } from '@/features/dashboard/utils/dashboardMobilePanel'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import React from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ShootHistoryDisplayControls } from './ShootHistoryDisplayControls'
import type { ShootHistorySort } from './shootHistorySorting'
import { HorizontalLoader } from '@/components/ui/horizontal-loader'
import { MultiSelectFilter } from '@/components/shoots/history/MultiSelectFilter'
import { ShootHistoryMlsQueueView } from '@/components/shoots/history/ShootHistoryMlsQueueView'
import {
  AvailableTab,
  FilterCollections,
  HistoryFiltersState,
  HistoryMeta,
  OperationalFiltersState,
  ShootHistoryDisplayMode,
} from '@/components/shoots/history/shootHistoryUtils'
import { getStateFullName } from '@/utils/stateUtils'
import {
  Building2,
  Calendar as CalendarIcon,
  Camera,
  DollarSign,
  Eye,
  Filter,
  Layers,
  Link2,
  Map as MapIcon,
  MoreVertical,
  Pin,
  RefreshCw,
} from 'lucide-react'

type LinkedAccount = {
  id: string | number
  accountName?: string | null
  mainAccountName?: string | null
  accountEmail?: string | null
  mainAccountEmail?: string | null
  status?: string | null
}

type SharedProperty = {
  id: string | number
  address: string
  city?: string | null
  state?: string | null
  shootCount?: number | null
}

type SharedPayment = {
  id: string | number
  amount: number
  date: string
  type: string
  status: string
}

type SharedData = {
  totalShoots?: number
  totalSpent?: number
  linkedAccounts?: unknown[]
  properties?: SharedProperty[]
  paymentHistory?: SharedPayment[]
  lastActivity?: string | null
}

type FilterValue = string | string[] | null | undefined

export type ShootHistoryViewProps = {
  gridContainerRef: React.RefObject<HTMLDivElement>
  isSuperAdmin: boolean
  isAdmin: boolean
  isEditingManager: boolean
  activeTab: AvailableTab
  setActiveTab: (value: AvailableTab) => void
  tabsConfig: AutoExpandingTab[]
  pinnedTabs: Set<AvailableTab>
  togglePinTab: (tab: AvailableTab) => void
  setIsBulkActionsOpen: React.Dispatch<React.SetStateAction<boolean>>
  viewMode: ShootHistoryDisplayMode
  shootSort: ShootHistorySort
  setShootSort: (sort: ShootHistorySort) => void
  setViewMode: React.Dispatch<React.SetStateAction<ShootHistoryDisplayMode>>
  gridColumns: 3 | 4
  setGridColumns: React.Dispatch<React.SetStateAction<3 | 4>>
  historyFilters: HistoryFiltersState
  setHistoryFilters: React.Dispatch<React.SetStateAction<HistoryFiltersState>>
  operationalFiltersOpen: boolean
  setOperationalFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
  historyFiltersOpen: boolean
  setHistoryFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
  fetchOperationalData: () => void
  scheduledSubTab: 'all' | 'requested' | 'scheduled'
  setScheduledSubTab: React.Dispatch<React.SetStateAction<'all' | 'requested' | 'scheduled'>>
  inProgressSubTab: 'all' | 'uploaded' | 'editing' | 'in_review'
  setInProgressSubTab: React.Dispatch<React.SetStateAction<'all' | 'uploaded' | 'editing' | 'in_review'>>
  deliveredSubTab: 'all' | 'delivered' | 'ready'
  setDeliveredSubTab: React.Dispatch<React.SetStateAction<'all' | 'delivered' | 'ready'>>
  hideDeliveredSubTabs: boolean
  holdSubTab: 'all' | 'on_hold' | 'cancelled'
  setHoldSubTab: React.Dispatch<React.SetStateAction<'all' | 'on_hold' | 'cancelled'>>
  historySubTab: 'all' | 'mls-queue'
  setHistorySubTab: React.Dispatch<React.SetStateAction<'all' | 'mls-queue'>>
  operationalFilters: OperationalFiltersState
  onOperationalFilterChange: (key: keyof OperationalFiltersState, value: FilterValue) => void
  operationalOptions: FilterCollections
  operationalServicesSelected: boolean
  resetOperationalFilters: () => void
  operationalMeta: HistoryMeta | null
  operationalPage: number
  handleOperationalPageChange: (direction: 'prev' | 'next') => void
  scheduledContent: React.ReactNode
  completedContent: React.ReactNode
  holdOnContent: React.ReactNode
  featuredContent: React.ReactNode
  canViewHistory: boolean
  historyOptions: FilterCollections
  onHistoryFilterChange: (key: keyof HistoryFiltersState, value: FilterValue) => void
  historyServicesSelected: boolean
  defaultHistoryFilters: HistoryFiltersState
  resetHistoryFilters: () => void
  historyMeta: HistoryMeta | null
  handleHistoryPageChange: (direction: 'prev' | 'next') => void
  historyContent: React.ReactNode
  calendarContent?: React.ReactNode
}

function SubTabButton({
  active,
  label,
  onClick,
  tone = 'default',
}: {
  active: boolean
  label: string
  onClick: () => void
  tone?: 'default' | 'requested' | 'scheduled' | 'ready' | 'delivered' | 'in_review'
}) {
  const activeClass =
    tone === 'requested'
      ? 'bg-sky-500 text-white shadow-sm hover:bg-sky-500'
      : tone === 'scheduled'
        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-600'
        : tone === 'ready'
      ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-500'
      : tone === 'delivered'
        ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-600'
        : tone === 'in_review'
        ? 'bg-violet-600 text-white shadow-sm hover:bg-violet-600'
        : 'bg-primary text-primary-foreground shadow-sm'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium leading-5 transition-colors ${
        active
          ? activeClass
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}

function PaginationRow({
  page,
  total,
  perPage,
  onChange,
}: {
  page: number
  total: number
  perPage: number
  onChange: (direction: 'prev' | 'next') => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(perPage, 1)))
  if (totalPages < 2) {
    return null
  }

  return (
    <div
      data-shoot-history-pagination
      className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm max-md:mt-auto max-md:mb-[5px]"
    >
      <div>
        Page {page} of {totalPages} · {total} records
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange('prev')} disabled={page === 1}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => onChange('next')} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  )
}

function ShootHistoryLinkedAccountsTab({
  linkedAccounts,
  sharedData,
  linkedLoading,
  linkedAccountsLoaded,
  user,
}: {
  linkedAccounts: LinkedAccount[]
  sharedData: SharedData | null
  linkedLoading: boolean
  linkedAccountsLoaded: boolean
  user: { name: string; email: string }
}) {
  return (
    <TabsContent value="linked" className="w-full space-y-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Linked Accounts View
                </h3>
                <p className="text-sm text-muted-foreground">
                  Combined data from {linkedAccounts.length + 1} linked account{linkedAccounts.length !== 0 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {linkedLoading ? (
              <HorizontalLoader message="Loading linked accounts..." />
            ) : (
              <>
                {linkedAccountsLoaded && linkedAccounts.length === 0 && (
                  <EmptyState icon="linked" title={<>No linked accounts yet. Invite another account to collaborate here.</>} size="compact" />
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <CalendarIcon className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <p className="text-2xl font-bold text-blue-600">{sharedData?.totalShoots || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Shoots</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <p className="text-2xl font-bold text-green-600">${(sharedData?.totalSpent || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Building2 className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                    <p className="text-2xl font-bold text-purple-600">{sharedData?.properties?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Properties</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <Camera className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                    <p className="text-2xl font-bold text-orange-600">{sharedData?.linkedAccounts?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Linked Accounts</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Linked Accounts</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium">{user.name[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{user.name} (You)</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <Badge variant="default">Main Account</Badge>
                    </div>

                    {linkedAccounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium">
                              {(account.accountName || account.mainAccountName || 'Unknown')[0]?.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{account.accountName || account.mainAccountName || 'Unknown Account'}</p>
                            <p className="text-xs text-muted-foreground">{account.accountEmail || account.mainAccountEmail || 'No email'}</p>
                          </div>
                        </div>
                        <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                          {account.status || 'Active'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {sharedData?.properties && sharedData.properties.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-medium text-sm">All Properties ({sharedData.properties.length})</h4>
                    <div className="grid gap-2">
                      {sharedData.properties.slice(0, 6).map((property) => (
                        <div key={property.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{property.address}</p>
                            <p className="text-xs text-muted-foreground">
                              {property.city}, {getStateFullName(property.state)} • {property.shootCount || 0} shoot{(property.shootCount || 0) !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      ))}
                      {sharedData.properties.length > 6 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          And {sharedData.properties.length - 6} more properties...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {sharedData?.paymentHistory && sharedData.paymentHistory.length > 0 && (
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-medium text-sm">Recent Payments (All Accounts)</h4>
                    <div className="space-y-2">
                      {sharedData.paymentHistory.slice(0, 5).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">${payment.amount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              {payment.date} • {payment.type}
                            </p>
                          </div>
                          <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                            {payment.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {sharedData?.lastActivity && (
              <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                Last activity across all accounts: {new Date(sharedData.lastActivity).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  )
}

export function ShootHistoryView(props: ShootHistoryViewProps) {
  const {
    gridContainerRef,
    isSuperAdmin,
    isAdmin,
    isEditingManager,
    activeTab,
    setActiveTab,
    tabsConfig,
    pinnedTabs,
    togglePinTab,
    setIsBulkActionsOpen,
    viewMode,
    shootSort,
    setShootSort,
    setViewMode,
    gridColumns,
    setGridColumns,
    historyFilters,
    setHistoryFilters,
    operationalFiltersOpen,
    setOperationalFiltersOpen,
    historyFiltersOpen,
    setHistoryFiltersOpen,
    fetchOperationalData,
    scheduledSubTab,
    setScheduledSubTab,
    inProgressSubTab,
    setInProgressSubTab,
    deliveredSubTab,
    setDeliveredSubTab,
    hideDeliveredSubTabs,
    holdSubTab,
    setHoldSubTab,
    historySubTab,
    setHistorySubTab,
    operationalFilters,
    onOperationalFilterChange,
    operationalOptions,
    operationalServicesSelected,
    resetOperationalFilters,
    operationalMeta,
    operationalPage,
    handleOperationalPageChange,
    scheduledContent,
    completedContent,
    holdOnContent,
    featuredContent,
    canViewHistory,
    historyOptions,
    onHistoryFilterChange,
    historyServicesSelected,
    defaultHistoryFilters,
    resetHistoryFilters,
    historyMeta,
    handleHistoryPageChange,
    historyContent,
  } = props

  const activeView = activeTab === 'history' ? historyFilters.viewAs : viewMode
  // xl+ Shoot History calendar owns overflow inside the shell (DashboardLayout
  // fillDesktopCalendar). List/grid/map keep an inner page scroller instead.
  const fillDesktopCalendar = useMediaQuery('(min-width: 1280px)')
  const isCalendarFill = fillDesktopCalendar && Boolean(props.calendarContent)
  const selectView = (view: ShootHistoryDisplayMode) => {
    if (view === 'calendar' || activeView === 'calendar') {
      setViewMode(view)
      setHistoryFilters(prev => ({ ...prev, viewAs: view }))
    } else if (activeTab === 'history') {
      setHistoryFilters(prev => ({ ...prev, viewAs: view }))
    } else {
      setViewMode(view)
    }
  }
  const displayControls = activeTab === 'history' && (historyFilters.groupBy === 'services' || historySubTab !== 'all') ? null : (
    <ShootHistoryDisplayControls
      allowCalendar={activeTab !== 'hold'}
      view={activeView} onViewChange={selectView}
      sort={shootSort} onSortChange={setShootSort} activeTab={activeTab}
      gridColumns={gridColumns} onGridColumnsChange={setGridColumns}
    />
  )
  const hasOperationalFiltersApplied =
    operationalServicesSelected ||
    Boolean(operationalFilters.search) ||
    Boolean(operationalFilters.clientId) ||
    Boolean(operationalFilters.photographerId) ||
    Boolean(operationalFilters.address) ||
    operationalFilters.dateRange !== 'all'
  const hasHistoryFiltersApplied =
    historyServicesSelected ||
    Boolean(historyFilters.search) ||
    Boolean(historyFilters.clientId) ||
    Boolean(historyFilters.photographerId) ||
    historyFilters.dateRange !== defaultHistoryFilters.dateRange ||
    historyFilters.groupBy !== 'shoot'
  const subTabRailClass =
    'flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'

  return (
    <div ref={gridContainerRef} data-grid-columns={gridColumns} className={cn(
      'shoot-history-tabs max-w-full space-y-4 overflow-x-clip',
      DASHBOARD_COMPACT_PAGE_X_CLASS,
      'pt-1.5 pb-0 max-md:flex max-md:min-h-full max-md:flex-1 max-md:flex-col sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0',
      isCalendarFill && 'is-calendar-fill flex min-h-0 flex-1 flex-col overflow-hidden sm:space-y-3 sm:pb-3',
      fillDesktopCalendar && !isCalendarFill && 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain',
    )}>
      <div className={cn('flex items-start justify-between gap-3', isCalendarFill && 'flex-shrink-0')}>
        {/* Compact title on phones (no description); full heading on desktop.
            Calendar fill drops the description to free vertical space. */}
        <div className={cn('min-w-0', isCalendarFill ? 'space-y-0' : 'space-y-1')}>
          <h1 className={cn('font-semibold tracking-tight', isCalendarFill ? 'text-lg md:text-xl' : 'text-lg md:text-3xl')}>Shoot History</h1>
          {!isCalendarFill && (
            <p className="hidden text-muted-foreground md:block">
              View and manage scheduled, completed, delivered, and on-hold shoots.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          {(isSuperAdmin || isAdmin || isEditingManager) && (
            <Button
              data-desktop-bulk-actions
              onClick={() => setIsBulkActionsOpen(true)}
              variant="outline"
              className="hidden gap-2 sm:inline-flex"
            >
              <Layers className="h-4 w-4" />
              Bulk Actions
            </Button>
          )}
          <div data-mobile-display-controls className="flex items-center gap-1 sm:hidden">{displayControls}</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 sm:hidden" title="View options" aria-label="View options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="sm:hidden w-52">
              {(isSuperAdmin || isAdmin || isEditingManager) && (
                <DropdownMenuItem data-mobile-bulk-actions onClick={() => setIsBulkActionsOpen(true)}>
                  <Layers className="mr-2 h-4 w-4" />
                  Bulk Actions
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => selectView('map')}>
                <MapIcon className="mr-2 h-4 w-4" />
                Map view
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => (activeTab === 'history' ? setHistoryFiltersOpen((prev) => !prev) : setOperationalFiltersOpen((prev) => !prev))}>
                <Filter className="mr-2 h-4 w-4" />
                {activeTab === 'history'
                  ? historyFiltersOpen
                    ? 'Hide filters'
                    : 'Show filters'
                  : operationalFiltersOpen
                    ? 'Hide filters'
                    : 'Show filters'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={fetchOperationalData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AvailableTab)} className={cn('space-y-3 max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col sm:pb-0', isCalendarFill && 'flex min-h-0 flex-1 flex-col overflow-hidden space-y-2')}>
        <div data-shoot-history-sticky-tabs className={cn('sticky -top-2 z-20 space-y-2 bg-background pt-0.5 sm:top-0', isCalendarFill && 'static flex-shrink-0')}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AutoExpandingTabsList tabs={tabsConfig} value={activeTab} desktopExpanded className="min-w-0 flex-1 pb-1" />
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 sm:inline-flex"
              onClick={() => togglePinTab(activeTab)}
              title={pinnedTabs.has(activeTab) ? 'Unpin tab' : 'Pin tab'}
            >
              <Pin className={`h-4 w-4 ${pinnedTabs.has(activeTab) ? 'fill-current' : ''}`} />
            </Button>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div data-desktop-display-controls className="flex items-center gap-2">{displayControls}</div>
            <Button variant={activeView === 'map' ? 'secondary' : 'ghost'} size="icon" aria-label="Map view" title="Map view" aria-pressed={activeView === 'map'} onClick={() => selectView('map')}>
              <MapIcon className="h-4 w-4" />
            </Button>
            {activeTab !== 'history' && (
              <Collapsible open={operationalFiltersOpen} onOpenChange={setOperationalFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant={operationalFiltersOpen ? 'outline' : 'ghost'}
                    size={operationalFiltersOpen ? 'sm' : 'icon'}
                    className={operationalFiltersOpen ? 'gap-2' : 'h-8 w-8'}
                    title={operationalFiltersOpen ? 'Hide filters' : 'Show filters'}
                  >
                    <Filter className="h-4 w-4" />
                    {operationalFiltersOpen && <span>Hide filters</span>}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
            <Button variant="ghost" size="icon" onClick={fetchOperationalData} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-4 overflow-hidden border-b border-border/50 pb-2">
          {activeTab === 'history' ? (
            <div className={subTabRailClass}>
              <SubTabButton active={historySubTab === 'all'} label="All Shoots" onClick={() => setHistorySubTab('all')} />
              <SubTabButton active={historySubTab === 'mls-queue'} label="MLS Queue" onClick={() => setHistorySubTab('mls-queue')} />
            </div>
          ) : activeTab === 'completed' ? (
            <div className={subTabRailClass}>
              <SubTabButton active={inProgressSubTab === 'all'} label="All" onClick={() => setInProgressSubTab('all')} />
              <SubTabButton active={inProgressSubTab === 'uploaded'} label="Uploaded" onClick={() => setInProgressSubTab('uploaded')} />
              <SubTabButton active={inProgressSubTab === 'editing'} label="Editing" onClick={() => setInProgressSubTab('editing')} />
              {(isSuperAdmin || isAdmin || isEditingManager) && (
                <SubTabButton
                  active={inProgressSubTab === 'in_review'}
                  label="In Review"
                  onClick={() => setInProgressSubTab('in_review')}
                  tone="in_review"
                />
              )}
            </div>
          ) : activeTab === 'delivered' && !hideDeliveredSubTabs ? (
            <div className={subTabRailClass}>
              <SubTabButton active={deliveredSubTab === 'all'} label="All" onClick={() => setDeliveredSubTab('all')} />
              <SubTabButton active={deliveredSubTab === 'ready'} label="Awaiting Finalize" onClick={() => setDeliveredSubTab('ready')} tone="ready" />
              <SubTabButton active={deliveredSubTab === 'delivered'} label="Delivered" onClick={() => setDeliveredSubTab('delivered')} tone="delivered" />
            </div>
          ) : activeTab === 'hold' ? (
            <div className={subTabRailClass}>
              <SubTabButton active={holdSubTab === 'all'} label="All" onClick={() => setHoldSubTab('all')} />
              <SubTabButton active={holdSubTab === 'on_hold'} label="On Hold" onClick={() => setHoldSubTab('on_hold')} />
              <SubTabButton active={holdSubTab === 'cancelled'} label="Cancelled" onClick={() => setHoldSubTab('cancelled')} />
            </div>
          ) : activeTab === 'scheduled' ? (
            <div className={subTabRailClass}>
              <SubTabButton active={scheduledSubTab === 'all'} label="All" onClick={() => setScheduledSubTab('all')} />
              <SubTabButton active={scheduledSubTab === 'requested'} label="Requested" onClick={() => setScheduledSubTab('requested')} tone="requested" />
              <SubTabButton active={scheduledSubTab === 'scheduled'} label="Scheduled" onClick={() => setScheduledSubTab('scheduled')} tone="scheduled" />
            </div>
          ) : (
            <div />
          )}
        </div>
        </div>

        <Collapsible open={operationalFiltersOpen} onOpenChange={setOperationalFiltersOpen}>
          <CollapsibleContent>
            <div className="rounded-2xl border bg-card p-4 mt-2">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Search</span>
                    <Input placeholder="Search by address, client, photographer" value={operationalFilters.search} onChange={(event) => onOperationalFilterChange('search', event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Client</span>
                    <Select value={operationalFilters.clientId || 'all'} onValueChange={(value) => onOperationalFilterChange('clientId', value)}>
                      <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All clients</SelectItem>
                        {operationalOptions.clients.filter((client) => client.id || client.name).map((client) => (
                          <SelectItem key={client.id ?? client.name ?? ''} value={String(client.id ?? client.name ?? '')}>
                            {client.name ?? 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Photographer</span>
                    <Select value={operationalFilters.photographerId || 'all'} onValueChange={(value) => onOperationalFilterChange('photographerId', value)}>
                      <SelectTrigger><SelectValue placeholder="All photographers" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All photographers</SelectItem>
                        {operationalOptions.photographers.filter((photographer) => photographer.id || photographer.name).map((photographer) => (
                          <SelectItem key={photographer.id ?? photographer.name ?? ''} value={String(photographer.id ?? photographer.name ?? '')}>
                            {photographer.name ?? 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Address</span>
                    <Input placeholder="Filter by address" value={operationalFilters.address} onChange={(event) => onOperationalFilterChange('address', event.target.value)} />
                  </div>
                  <MultiSelectFilter label="Services" options={operationalOptions.services} values={operationalFilters.services} onChange={(values) => onOperationalFilterChange('services', values)} />
                  {viewMode === 'calendar' ? (
                    <p className="self-center text-sm text-muted-foreground">Calendar dates are controlled by the Month, Week and Day navigation.</p>
                  ) : (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">Date range</span>
                    <Select value={operationalFilters.dateRange} onValueChange={(value) => onOperationalFilterChange('dateRange', value as OperationalFiltersState['dateRange'])}>
                      <SelectTrigger><SelectValue placeholder="All dates" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All dates</SelectItem>
                        <SelectItem value="this_week">This week</SelectItem>
                        <SelectItem value="this_month">This month</SelectItem>
                        <SelectItem value="this_quarter">This quarter</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                  {viewMode !== 'calendar' && operationalFilters.dateRange === 'custom' && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Custom range</span>
                      <DateRangePicker
                        value={{
                          startDate: operationalFilters.scheduledStart,
                          endDate: operationalFilters.scheduledEnd,
                        }}
                        onChange={({ startDate, endDate }) => {
                          onOperationalFilterChange('scheduledStart', startDate)
                          onOperationalFilterChange('scheduledEnd', endDate)
                        }}
                        placeholder="Choose scheduled range"
                      />
                    </div>
                  )}
                </div>
                {hasOperationalFiltersApplied && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Filters applied.</span>
                    <Button variant="ghost" size="sm" onClick={resetOperationalFilters}>Clear filters</Button>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {[
          { value: 'scheduled', content: scheduledContent },
          { value: 'editing', content: completedContent },
          { value: 'edited', content: completedContent },
          { value: 'delivered', content: completedContent },
          { value: 'completed', content: completedContent },
          { value: 'hold', content: holdOnContent },
          { value: 'featured', content: featuredContent },
        ].map(({ value, content }) => (
          <TabsContent key={value} value={value} className={cn('flex w-full flex-1 flex-col gap-6', isCalendarFill && viewMode === 'calendar' && 'min-h-0 gap-0 overflow-hidden')}>
            {viewMode === 'calendar' ? props.calendarContent : content}
            {viewMode !== 'calendar' && operationalMeta && operationalMeta.total > 0 && (
              <PaginationRow page={operationalPage} total={operationalMeta.total} perPage={operationalMeta.per_page} onChange={handleOperationalPageChange} />
            )}
          </TabsContent>
        ))}

        {canViewHistory && (
          <TabsContent value="history" className={cn('flex w-full flex-1 flex-col gap-6', isCalendarFill && 'min-h-0 gap-0 overflow-hidden')}>
            <Tabs value={historySubTab} onValueChange={(value) => setHistorySubTab(value as 'all' | 'mls-queue')} className={cn('flex w-full min-h-0 flex-1 flex-col', isCalendarFill && 'overflow-hidden')}>
              <Collapsible open={historyFiltersOpen} onOpenChange={setHistoryFiltersOpen}>
                <CollapsibleContent>
                  <div className="rounded-2xl border bg-card p-4 mt-2">
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium">Reporting filters</p>
                        <p className="text-sm text-muted-foreground">Date ranges, grouping and drill-down controls.</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Search</span>
                          <Input placeholder="Client, address, company" value={historyFilters.search} onChange={(event) => onHistoryFilterChange('search', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Client</span>
                          <Select value={historyFilters.clientId || 'all'} onValueChange={(value) => onHistoryFilterChange('clientId', value)}>
                            <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All clients</SelectItem>
                              {historyOptions.clients.filter((client) => client.id || client.name).map((client) => (
                                <SelectItem key={client.id ?? client.name ?? ''} value={String(client.id ?? client.name ?? '')}>
                                  {client.name ?? 'Unknown'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Photographer</span>
                          <Select value={historyFilters.photographerId || 'all'} onValueChange={(value) => onHistoryFilterChange('photographerId', value)}>
                            <SelectTrigger><SelectValue placeholder="All photographers" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All photographers</SelectItem>
                              {historyOptions.photographers.filter((photographer) => photographer.id || photographer.name).map((photographer) => (
                                <SelectItem key={photographer.id ?? photographer.name ?? ''} value={String(photographer.id ?? photographer.name ?? '')}>
                                  {photographer.name ?? 'Unknown'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <MultiSelectFilter label="Services" options={historyOptions.services} values={historyFilters.services} onChange={(values) => onHistoryFilterChange('services', values)} />
                        {historyFilters.viewAs === 'calendar' && historyFilters.groupBy === 'shoot' ? (
                          <p className="self-center text-sm text-muted-foreground">Calendar dates are controlled by the Month, Week and Day navigation.</p>
                        ) : (<>
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Date range preset</span>
                          <Select value={historyFilters.dateRange} onValueChange={(value) => onHistoryFilterChange('dateRange', value as HistoryFiltersState['dateRange'])}>
                            <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All time</SelectItem>
                              <SelectItem value="this_quarter">This quarter</SelectItem>
                              <SelectItem value="this_month">This month</SelectItem>
                              <SelectItem value="q1">Q1</SelectItem>
                              <SelectItem value="q2">Q2</SelectItem>
                              <SelectItem value="q3">Q3</SelectItem>
                              <SelectItem value="q4">Q4</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Scheduled range</span>
                          <DateRangePicker
                            value={{
                              startDate: historyFilters.scheduledStart,
                              endDate: historyFilters.scheduledEnd,
                            }}
                            onChange={({ startDate, endDate }) => {
                              onHistoryFilterChange('scheduledStart', startDate)
                              onHistoryFilterChange('scheduledEnd', endDate)
                            }}
                            placeholder="Choose scheduled range"
                            disabled={historyFilters.dateRange !== 'custom'}
                          />
                        </div>
                        </>)}
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Completed range</span>
                          <DateRangePicker
                            value={{
                              startDate: historyFilters.completedStart,
                              endDate: historyFilters.completedEnd,
                            }}
                            onChange={({ startDate, endDate }) => {
                              onHistoryFilterChange('completedStart', startDate)
                              onHistoryFilterChange('completedEnd', endDate)
                            }}
                            placeholder="Choose completed range"
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-muted-foreground">Group by</span>
                          <Select value={historyFilters.groupBy} onValueChange={(value) => onHistoryFilterChange('groupBy', value as HistoryFiltersState['groupBy'])}>
                            <SelectTrigger><SelectValue placeholder="Per shoot" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="shoot">Per shoot</SelectItem>
                              <SelectItem value="services">Services</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {hasHistoryFiltersApplied && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Filters applied.</span>
                          <Button variant="ghost" size="sm" onClick={resetHistoryFilters}>Clear filters</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <TabsContent value="all" className={cn('flex w-full flex-1 flex-col gap-6', isCalendarFill && historyFilters.viewAs === 'calendar' && 'min-h-0 gap-0 overflow-hidden')}>
                {historyFilters.viewAs === 'calendar' && historyFilters.groupBy === 'shoot' ? props.calendarContent : historyContent}
                {historyFilters.viewAs !== 'calendar' && historyMeta && historyFilters.groupBy === 'shoot' && (
                  <PaginationRow page={historyMeta.current_page} total={historyMeta.total} perPage={historyMeta.per_page} onChange={handleHistoryPageChange} />
                )}
              </TabsContent>

              <TabsContent value="mls-queue" className="w-full space-y-6">
                <ShootHistoryMlsQueueView />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

      </Tabs>
    </div>
  )
}
