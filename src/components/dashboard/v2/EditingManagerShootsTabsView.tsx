import { DashboardShootFilters, DashboardFilterChips } from './DashboardShootFilters';
import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { DashboardMobileToolbarContext } from '@/features/dashboard/components/dashboardMobileToolbarContext';
import { Card } from './SharedComponents';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronsDown, Filter, List, MoreVertical, X } from 'lucide-react';
import type { useShootsTabsCardController } from './useShootsTabsCardController';
import { DASHBOARD_MOBILE_LIST_SHELL_CLASS, DASHBOARD_MOBILE_PANEL_CLASS } from '@/features/dashboard/utils/dashboardMobilePanel';
import { EarlierShootsStack } from './EarlierShootsStack';
import { isStaffShootStackRole } from './earlierUnfinishedShoots';

export function EditingManagerShootsTabsView({ model }: { model: ReturnType<typeof useShootsTabsCardController> }) {
  const {
    title,
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    draftFilters,
    setDraftFilters,
    isFilterOpen,
    setIsFilterOpen,
    isMenuOpen,
    setIsMenuOpen,
    isCompactMobile,
    setIsCompactMobile,
    scrollContainerRef,
    loadMoreSentinelRef,
    clientOptions,
    photographerOptions,
    serviceOptions,
    applyFilters,
    resetFilters,
    cancelFilters,
    activeFilterCount,
    getRelativeGroupLabel,
    editingManagerTabs,
    activeEditingManagerTab,
    editingManagerPaginatedGroups,
    editingManagerHasMore,
    handleScroll,
    loadMoreShoots,
    listMaxHeight,
    renderShootCard,
    role,
    onSelect,
    editingManagerEarlierShoots,
    isCompactDashboardViewport,
  } = model;
  const mobileFilterHost = useContext(DashboardMobileToolbarContext);
  const hoistFilter = isCompactDashboardViewport && mobileFilterHost !== null;
  const staffStack = isStaffShootStackRole(role);
  const inlineCompactControl = staffStack && isCompactDashboardViewport;

  const renderCompactToggle = (opts?: { iconOnly?: boolean; className?: string }) => {
    const iconOnly = Boolean(opts?.iconOnly);
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCompactMobile((prev) => !prev)}
        className={cn(
          'pointer-events-auto inline-flex h-7 items-center justify-center rounded-full text-[11px] font-semibold',
          iconOnly ? 'w-7 shrink-0 px-0' : 'px-2.5',
          isCompactMobile
            ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          opts?.className,
        )}
        aria-label={isCompactMobile ? 'Show full shoot cards' : 'Show compact shoot cards'}
        aria-pressed={isCompactMobile}
        title={isCompactMobile ? 'Show full shoot cards' : 'Show compact shoot cards'}
      >
        <List size={14} className={cn(!iconOnly && 'mr-1')} />
        {!iconOnly && (isCompactMobile ? 'Full view' : 'Compact')}
      </Button>
    );
  };

  const filterButton = (
    <Button
      variant="secondary"
      size="sm"
      className={cn('relative rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 max-[1550px]:px-2', staffStack && 'max-[1024px]:h-9 max-[1024px]:w-9 max-[1024px]:!p-0', hoistFilter && 'h-10 w-10 !p-0')}
      onClick={() => {
        setDraftFilters(filters);
        setIsFilterOpen((open) => !open);
      }}
      aria-label="Filters"
      aria-expanded={isFilterOpen}
    >
      <Filter size={14} className="mr-1.5 max-[1550px]:mr-0" />
      <span className="max-[1550px]:hidden">
        Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
      </span>
      {activeFilterCount > 0 && (
        <span className={cn('hidden max-[1550px]:inline ml-1 text-[10px] font-semibold', inlineCompactControl && 'absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-primary px-1 text-center text-primary-foreground')}>
          {inlineCompactControl ? activeFilterCount : `(${activeFilterCount})`}
        </span>
      )}
    </Button>
  );

    return (
      <Card className={cn(DASHBOARD_MOBILE_PANEL_CLASS, "flex flex-col h-full flex-1 relative min-h-0")}>
        {hoistFilter && mobileFilterHost && createPortal(filterButton, mobileFilterHost)}
        {!staffStack && <div className="absolute right-2 top-2 z-10 flex items-center gap-1 sm:hidden">
          {renderCompactToggle({ iconOnly: true })}
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <ChevronsDown size={16} /> : <MoreVertical size={16} />}
          </button>
        </div>}

        {/* Sub-tabs denser than section pills: tight chips, no wrap, scroll at ~390px. */}
        <div className={cn('mb-1 flex min-w-0 flex-nowrap items-center justify-between gap-1.5 sm:mb-2 sm:flex-wrap sm:gap-3', staffStack ? 'max-[1024px]:grid max-[1024px]:grid-cols-[minmax(0,1fr)_auto] max-[1024px]:items-start max-[1024px]:gap-2' : 'pr-14 sm:pr-0')}>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <h2 className={cn('hidden sm:block text-lg font-bold text-foreground', staffStack && 'shrink-0')}>{title}</h2>
            <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain hidden-scrollbar">
              <div className="inline-flex w-max max-w-none items-center gap-0.5 rounded-full border border-border/40 bg-muted/25 p-0.5 sm:gap-1 sm:rounded-none sm:border-0 sm:border-b sm:border-transparent sm:bg-transparent sm:p-0 sm:pl-0">
              {editingManagerTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'shrink-0 whitespace-nowrap transition-all',
                    // Mobile: compact chips (match section-tab density, smaller).
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-tight tracking-tight',
                    // sm+: keep underline tab chrome.
                    'sm:rounded-none sm:border-b-2 sm:px-3 sm:py-1.5 sm:text-sm sm:font-medium sm:leading-normal',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground sm:bg-transparent sm:text-foreground sm:border-primary'
                      : 'text-muted-foreground hover:text-foreground sm:border-transparent',
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      'ml-0.5 tabular-nums text-[10px] sm:ml-1 sm:text-inherit',
                      activeTab === tab.id ? 'opacity-90 sm:opacity-70' : 'opacity-60 sm:opacity-70',
                    )}
                  >
                    ({tab.shoots.length})
                  </span>
                </button>
              ))}
              </div>
            </div>
          </div>
          <div className={cn('items-center gap-2', staffStack ? 'flex flex-nowrap shrink-0 max-[1024px]:justify-self-end max-[1024px]:self-start' : 'hidden sm:flex')}>
            {inlineCompactControl && renderCompactToggle({ iconOnly: true })}
            {!hoistFilter && filterButton}
          </div>
        </div>

        {!staffStack && isMenuOpen && (
          <div className="-mt-0.5 mb-2 flex items-center gap-2 sm:hidden">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900"
              onClick={() => {
                setDraftFilters(filters);
                setIsFilterOpen((open) => !open);
              }}
              aria-expanded={isFilterOpen}
            >
              <Filter size={14} className="mr-1.5" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          </div>
        )}

        <DashboardShootFilters open={isFilterOpen} title={'Filter shoots'} role={role}
        filters={filters} draft={draftFilters} onDraftChange={setDraftFilters}
        onApply={applyFilters} onCancel={cancelFilters} onReset={resetFilters}
        clientOptions={clientOptions} photographerOptions={photographerOptions} serviceOptions={serviceOptions} />
      <DashboardFilterChips filters={filters} onChange={setFilters} onReset={resetFilters} role={role}
        clientOptions={clientOptions} photographerOptions={photographerOptions} serviceOptions={serviceOptions} />

        <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', DASHBOARD_MOBILE_LIST_SHELL_CLASS)}>
          {editingManagerPaginatedGroups.length === 0 && (!staffStack || editingManagerEarlierShoots.length === 0) ? (
            <div className="flex-1 w-full min-h-[120px] flex items-center justify-center text-center text-sm text-slate-500">
              {activeEditingManagerTab?.emptyStateText || 'No shoots found.'}
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hidden-scrollbar"
              // Cap the EM upcoming-style list (~10 cards); keep inner scroll + sticky day pills.
              style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
            >
              {staffStack && editingManagerEarlierShoots.length > 0 && <EarlierShootsStack shoots={editingManagerEarlierShoots} role={role} onSelect={onSelect} className="mb-4" />}
              {!inlineCompactControl && <div className="pointer-events-none sticky top-0 z-20 flex h-0 justify-end">
                {renderCompactToggle({ className: 'hidden sm:inline-flex' })}
              </div>}
              {editingManagerPaginatedGroups.map((group, groupIndex) => (
                <div key={group.label} className={cn('space-y-3', groupIndex > 0 && 'mt-6')}>
                  <div className="sticky top-0 z-10 bg-card py-0.5">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-transparent py-1 pl-2 pr-8">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        {getRelativeGroupLabel(group)}
                      </p>
                    </div>
                  </div>
                  {group.shoots.map((shoot) => renderShootCard(shoot, false))}
                </div>
              ))}
              {editingManagerHasMore && (
                <div
                  ref={loadMoreSentinelRef}
                  className="flex justify-center py-2 mt-6"
                >
                  <button
                    type="button"
                    onClick={loadMoreShoots}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
}
