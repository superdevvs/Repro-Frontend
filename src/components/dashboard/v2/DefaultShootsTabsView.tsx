import { DashboardShootFilters, DashboardFilterChips } from './DashboardShootFilters';
import { ShootEmptyState } from '@/components/shoots/ShootEmptyState';
import { Card } from './SharedComponents';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { ChevronsDown, Filter, History, List, MoreVertical } from 'lucide-react';
import type { useShootsTabsCardController } from './useShootsTabsCardController';
import { DASHBOARD_MOBILE_LIST_SHELL_CLASS, DASHBOARD_MOBILE_PANEL_CLASS } from '@/features/dashboard/utils/dashboardMobilePanel';
import { EarlierShootsStack } from './EarlierShootsStack';
import { isStaffShootStackRole } from './earlierUnfinishedShoots';

export function DefaultShootsTabsView({ model }: { model: ReturnType<typeof useShootsTabsCardController> }) {
  const {
    title,
    activeTab,
    setActiveTab,
    hasUnreadRequests,
    filters,
    setFilters,
    draftFilters,
    setDraftFilters,
    isFilterOpen,
    setIsFilterOpen,
    showPastDays,
    setShowPastDays,
    showPastRequests,
    setShowPastRequests,
    isMenuOpen,
    setIsMenuOpen,
    isCompactMobile,
    setIsCompactMobile,
    scrollContainerRef,
    loadMoreSentinelRef,
    pastRequests,
    hasPastRequests,
    clientOptions,
    photographerOptions,
    serviceOptions,
    applyFilters,
    resetFilters,
    cancelFilters,
    filteredRequestedShoots,
    activeFilterCount,
    getRelativeGroupLabel,
    requestedGroups,
    hasPastDays,
    paginatedGroups,
    hasMore,
    handleScroll,
    loadMoreShoots,
    listMaxHeight,
    renderShootCard,
    upcomingCount,
    requestedCount,
    role,
    onSelect,
    earlierShoots,
    isCompactDashboardViewport,
  } = model;
  const staffStack = isStaffShootStackRole(role);
  const inlineCompactControl = staffStack && isCompactDashboardViewport;
  // Compact viewport (staff): the compact toggle rides on the first day-group
  // pill row of the active list, right-aligned. With no pill row (empty list,
  // earlier-only list) it stays in the header next to History/Filters.
  const compactInPillRow = inlineCompactControl && (
    activeTab === 'upcoming'
      ? paginatedGroups.length > 0
      : filteredRequestedShoots.length > 0 && requestedGroups.length > 0
  );
  const pillRowCompactToggle = (groupIndex: number) =>
    compactInPillRow && groupIndex === 0
      ? renderCompactToggle({ iconOnly: true, className: 'shrink-0' })
      : null;

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

  return (
    <Card className={cn(
      DASHBOARD_MOBILE_PANEL_CLASS,
      'relative flex flex-col min-h-0 overflow-hidden',
      activeTab === 'requested' ? 'h-full flex-1 lg:h-auto lg:flex-none' : 'h-full flex-1',
    )}>
      {/* Compact + 3-dot menu — always visible on mobile chrome */}
      {!staffStack && <div className="sm:hidden absolute top-3 right-3 z-10 flex items-center gap-1">
        {renderCompactToggle({ iconOnly: true })}
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <ChevronsDown size={16} /> : <MoreVertical size={16} />}
        </button>
      </div>}

      {/* Header with static "Shoots" title and inline tabs */}
      <div className={cn('flex flex-wrap items-center justify-between mb-2 gap-3', staffStack ? 'max-[1024px]:grid max-[1024px]:grid-cols-[minmax(0,1fr)_auto] max-[1024px]:items-start max-[1024px]:gap-2' : 'pr-16 sm:pr-0')}>
        <div className={cn('flex items-center gap-4', staffStack && 'min-w-0')}>
          <h2 className={cn('hidden sm:block text-lg font-bold text-foreground', staffStack && 'shrink-0')}>Shoots</h2>
          <div className={cn('flex items-center gap-1 border-b border-transparent pl-1 sm:pl-0', staffStack && 'min-w-0 max-[1024px]:overflow-x-auto max-[1024px]:overscroll-x-contain hidden-scrollbar')}>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={cn(
                'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
                staffStack && 'shrink-0',
                activeTab === 'upcoming'
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              onClick={() => setActiveTab('requested')}
              disabled={requestedCount === 0}
              className={cn(
                'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
                staffStack && 'shrink-0',
                requestedCount === 0
                  ? 'text-muted-foreground/35 border-transparent cursor-not-allowed'
                  : activeTab === 'requested'
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                Requested
                {requestedCount > 0 && (
                  <span
                    className={cn(
                      'ml-1 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors',
                      hasUnreadRequests
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {requestedCount}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
        {/* Desktop: inline filter/previous buttons */}
        <div className={cn('items-center gap-2', staffStack ? 'flex flex-nowrap shrink-0 max-[1024px]:justify-self-end max-[1024px]:self-start' : 'hidden sm:flex')}>
          {inlineCompactControl && !compactInPillRow && renderCompactToggle({ iconOnly: true })}
          {activeTab === 'upcoming' && (
            <Button
              variant="outline"
              size="sm"
              className={cn('text-xs rounded-full border-dashed', staffStack && 'max-[1024px]:h-9 max-[1024px]:w-9 max-[1024px]:p-0', staffStack && showPastDays && 'bg-primary/10 text-primary')}
              onClick={() => setShowPastDays((prev) => !prev)}
              disabled={!hasPastDays}
              aria-label={staffStack ? (showPastDays ? 'Hide previous shoots' : 'Previous shoots') : undefined}
              aria-pressed={showPastDays}
              title={showPastDays ? 'Hide previous shoots' : 'Previous shoots'}
            >
              {staffStack && <History size={16} className="hidden max-[1024px]:block" aria-hidden="true" />}
              <span className="max-[1550px]:hidden">
                {hasPastDays ? (showPastDays ? 'Hide past' : 'Previous shoots') : 'Previous shoots'}
              </span>
              <span className={cn('hidden max-[1550px]:inline', staffStack && 'max-[1024px]:!hidden')}>
                {hasPastDays && showPastDays ? 'Hide' : 'Previous'}
              </span>
            </Button>
          )}
          {activeTab === 'requested' && (
            <Button
              variant="outline"
              size="sm"
              className={cn('text-xs rounded-full border-dashed', staffStack && 'max-[1024px]:h-9 max-[1024px]:w-9 max-[1024px]:p-0')}
              onClick={() => setShowPastRequests((prev) => !prev)}
              disabled={!hasPastRequests}
              aria-label={staffStack ? (showPastRequests ? 'Hide previous requests' : 'Previous requests') : undefined}
              aria-pressed={showPastRequests}
              title={showPastRequests ? 'Hide previous requests' : 'Previous requests'}
            >
              {staffStack && <History size={16} className="hidden max-[1024px]:block" aria-hidden="true" />}
              <span className="max-[1550px]:hidden">
                {hasPastRequests
                  ? (showPastRequests ? 'Hide past' : `Previous requests (${pastRequests.length})`)
                  : 'Previous requests'}
              </span>
              <span className={cn('hidden max-[1550px]:inline', staffStack && 'max-[1024px]:!hidden')}>
                {hasPastRequests && showPastRequests ? 'Hide' : 'Previous'}
              </span>
            </Button>
          )}
          <Button
              variant="secondary"
              size="sm"
              className={cn('relative rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 max-[1550px]:px-2', staffStack && 'max-[1024px]:h-9 max-[1024px]:w-9 max-[1024px]:!p-0')}
              onClick={() => { setDraftFilters(filters); setIsFilterOpen((open) => !open); }}
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
        </div>
      </div>

      {/* Mobile: expandable menu row (shown when 3-dot is tapped) */}
      {!staffStack && isMenuOpen && (
        <div className="sm:hidden flex items-center gap-2 mb-3 -mt-1">
          {activeTab === 'upcoming' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastDays((prev) => !prev)}
              disabled={!hasPastDays}
            >
              {hasPastDays ? (showPastDays ? 'Hide past' : 'Previous shoots') : 'Previous shoots'}
            </Button>
          )}
          {activeTab === 'requested' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastRequests((prev) => !prev)}
              disabled={!hasPastRequests}
            >
              {hasPastRequests
                ? (showPastRequests ? 'Hide past' : `Previous requests (${pastRequests.length})`)
                : 'Previous requests'}
            </Button>
          )}
          <Button
              variant="secondary"
              size="sm"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900"
              onClick={() => { setDraftFilters(filters); setIsFilterOpen((open) => !open); }}
              aria-expanded={isFilterOpen}
            >
              <Filter size={14} className="mr-1.5" />
              Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
        </div>
      )}

      {/* Shared filter dialog (used by both mobile and desktop) */}
      <DashboardShootFilters open={isFilterOpen} title={'Filter shoots'} role={role}
        filters={filters} draft={draftFilters} onDraftChange={setDraftFilters}
        onApply={applyFilters} onCancel={cancelFilters} onReset={resetFilters}
        clientOptions={clientOptions} photographerOptions={photographerOptions} serviceOptions={serviceOptions} />
      <DashboardFilterChips filters={filters} onChange={setFilters} onReset={resetFilters} role={role}
        clientOptions={clientOptions} photographerOptions={photographerOptions} serviceOptions={serviceOptions} />

      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', DASHBOARD_MOBILE_LIST_SHELL_CLASS)}>
        {activeTab === 'upcoming' ? (
          paginatedGroups.length === 0 && (!staffStack || earlierShoots.length === 0) ? (
            <ShootEmptyState title="No upcoming shoots" filtered={activeFilterCount > 0} onReset={resetFilters} allowBooking onViewRequested={() => setActiveTab('requested')} className="flex-1" />
          ) : (
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hidden-scrollbar"
              // Cap the upcoming list (~10 cards) so overflow scrolls inside the
              // column; sticky day pills stay relative to this scroller. PIPELINE
              // / delivered still use their own adaptive fill elsewhere.
              style={listMaxHeight ? { maxHeight: listMaxHeight, minHeight: isCompactMobile ? '100%' : undefined } : undefined}
            >
              {staffStack && earlierShoots.length > 0 && <EarlierShootsStack shoots={earlierShoots} role={role} onSelect={onSelect} className="mb-4" />}
              {!inlineCompactControl && <div className="pointer-events-none sticky top-0 z-20 flex h-0 justify-end">
                {renderCompactToggle({ className: 'hidden sm:inline-flex' })}
              </div>}
              {paginatedGroups.map((group, groupIndex) => (
                <div key={group.label} className={cn('space-y-3', groupIndex > 0 && 'mt-6')}>
                  <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-card py-0.5">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-primary/20 to-transparent py-1 pl-2 pr-8">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        {getRelativeGroupLabel(group)}
                      </p>
                    </div>
                    {pillRowCompactToggle(groupIndex)}
                  </div>
                  {group.shoots.map((shoot) => renderShootCard(shoot, false))}
                </div>
              ))}
              {hasMore && (
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
          )
        ) : (
          filteredRequestedShoots.length === 0 ? (
            <ShootEmptyState title="No pending requests" requested filtered={activeFilterCount > 0} onReset={resetFilters} className="flex-1" />
          ) : (
            <div 
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hidden-scrollbar"
              style={listMaxHeight ? { maxHeight: listMaxHeight, minHeight: isCompactMobile ? '100%' : undefined } : undefined}
            >
              {!inlineCompactControl && <div className="pointer-events-none sticky top-0 z-20 flex h-0 justify-end">
                {renderCompactToggle({ className: 'hidden sm:inline-flex' })}
              </div>}
              {requestedGroups.map((group, groupIndex) => (
                <div key={group.label} className={cn('space-y-3', groupIndex > 0 && 'mt-6')}>
                  <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-card py-0.5">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-blue-500/20 to-transparent py-1 pl-2 pr-8">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        {getRelativeGroupLabel(group)}
                      </p>
                    </div>
                    {pillRowCompactToggle(groupIndex)}
                  </div>
                  {group.shoots.map((shoot) => renderShootCard(shoot, true))}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Card>
  );
}
