import { createPortal } from 'react-dom';
import { Avatar, Card } from './SharedComponents';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ChevronsDown, Filter, List, MoreVertical, X } from 'lucide-react';
import { DATE_RANGE_OPTIONS, SERVICE_LABELS, STATUS_FILTERS } from './shootsTabsCardUtils';
import type { useShootsTabsCardController } from './useShootsTabsCardController';

export function DefaultShootsTabsView({ model }: { model: ReturnType<typeof useShootsTabsCardController> }) {
  const {
    title,
    showAssignmentFilters,
    activeTab,
    setActiveTab,
    hasUnreadRequests,
    filters,
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
    filterPanelHostRef,
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
  } = model;

  const renderStickyCompactToggle = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsCompactMobile((prev) => !prev)}
      className={cn(
        'pointer-events-auto hidden sm:inline-flex h-7 rounded-full px-2.5 text-[11px] font-semibold',
        isCompactMobile
          ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
      aria-label={isCompactMobile ? 'Show full shoot cards' : 'Show compact shoot cards'}
      title={isCompactMobile ? 'Show full shoot cards' : 'Show compact shoot cards'}
    >
      <List size={14} className="mr-1" />
      {isCompactMobile ? 'Full view' : 'Compact'}
    </Button>
  );

  return (
    <Card className={cn(
      'relative flex flex-col',
      activeTab === 'requested' ? 'h-auto flex-none' : 'h-full flex-1',
    )}>
      {/* 3-dot / chevron menu toggle — top-right corner on mobile */}
      <button
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="sm:hidden absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
        aria-label="Toggle menu"
      >
        {isMenuOpen ? <ChevronsDown size={16} /> : <MoreVertical size={16} />}
      </button>

      {/* Header with static "Shoots" title and inline tabs */}
      <div className="flex flex-wrap items-center justify-between mb-2 gap-3 pr-10 sm:pr-0">
        <div className="flex items-center gap-4">
          <h2 className="hidden sm:block text-lg font-bold text-foreground">Shoots</h2>
          <div className="flex items-center gap-1 border-b border-transparent pl-1 sm:pl-0">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={cn(
                'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
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
        <div className="hidden sm:flex items-center gap-2">
          {activeTab === 'upcoming' && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastDays((prev) => !prev)}
              disabled={!hasPastDays}
            >
              <span className="max-[1550px]:hidden">
                {hasPastDays ? (showPastDays ? 'Hide past' : 'Previous shoots') : 'Previous shoots'}
              </span>
              <span className="hidden max-[1550px]:inline">
                {hasPastDays && showPastDays ? 'Hide' : 'Previous'}
              </span>
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
              <span className="max-[1550px]:hidden">
                {hasPastRequests
                  ? (showPastRequests ? 'Hide past' : `Previous requests (${pastRequests.length})`)
                  : 'Previous requests'}
              </span>
              <span className="hidden max-[1550px]:inline">
                {hasPastRequests && showPastRequests ? 'Hide' : 'Previous'}
              </span>
            </Button>
          )}
          {activeTab !== 'requested' && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 max-[1550px]:px-2"
              onClick={() => { setDraftFilters(filters); setIsFilterOpen((open) => !open); }}
              aria-label="Filters"
              aria-expanded={isFilterOpen}
            >
              <Filter size={14} className="mr-1.5 max-[1550px]:mr-0" />
              <span className="max-[1550px]:hidden">
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </span>
              {activeFilterCount > 0 && (
                <span className="hidden max-[1550px]:inline ml-1 text-[10px] font-semibold">
                  ({activeFilterCount})
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: expandable menu row (shown when 3-dot is tapped) */}
      {isMenuOpen && (
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
          {activeTab !== 'requested' && (
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
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCompactMobile((prev) => !prev)}
            className={cn(
              "h-9 rounded-full px-3",
              isCompactMobile
                ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            aria-label={isCompactMobile ? "Show full shoot cards" : "Show compact shoot cards"}
          >
            <List size={16} />
          </Button>
        </div>
      )}

      {/* Shared filter dialog (used by both mobile and desktop) */}
      {filterPanelHostRef.current && createPortal(
        <div className={cn(
          'grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out',
          isFilterOpen ? 'grid-rows-[1fr] opacity-100 mb-4' : 'grid-rows-[0fr] opacity-0 mb-0 pointer-events-none',
        )}>
          <div className="min-h-0 overflow-hidden">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5 max-h-[65vh] overflow-y-auto">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                <h3 className="text-base sm:text-lg font-semibold">Filter shoots</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Narrow the list by status, assignments, services, and priority.
                </p>
                </div>
                <Button variant="ghost" size="sm" onClick={cancelFilters}>Close</Button>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {STATUS_FILTERS.map((status) => {
                      const active = draftFilters.statuses.includes(status.value);
                      return (
                        <button
                          key={status.value}
                          onClick={() =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              statuses: active
                                ? prev.statuses.filter((s) => s !== status.value)
                                : [...prev.statuses, status.value],
                            }))
                          }
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                            active
                              ? 'bg-primary/10 border-primary/40 text-primary'
                              : 'border-border text-muted-foreground',
                          )}
                        >
                          {status.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-3 sm:gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Client</p>
                      <Select
                        value={draftFilters.client}
                        onValueChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, client: value }))
                        }
                      >
                        <SelectTrigger className="rounded-xl border-border bg-muted/40">
                          <SelectValue placeholder="All clients" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientOptions.map((client) => (
                            <SelectItem key={client} value={client}>
                              {client === 'all' ? 'All clients' : client}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Search address, zip</p>
                      <Input
                        value={draftFilters.address}
                        onChange={(event) =>
                          setDraftFilters((prev) => ({ ...prev, address: event.target.value }))
                        }
                        placeholder="City, street, zip"
                        className="rounded-xl border-border bg-muted/40"
                      />
                    </div>
                  </div>
                </section>

                {showAssignmentFilters && <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Photographer</p>
                  <div className="rounded-2xl border border-border/60 bg-muted/30">
                    <ScrollArea className="max-h-64">
                      <div className="p-3 space-y-2">
                        {photographerOptions.map((photographer) => {
                          const checked = draftFilters.photographerIds.includes(photographer.id);
                          return (
                            <label
                              key={photographer.id}
                              className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-background/60"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  setDraftFilters((prev) => ({
                                    ...prev,
                                    photographerIds: value
                                      ? [...prev.photographerIds, photographer.id]
                                      : prev.photographerIds.filter((id) => id !== photographer.id),
                                  }))
                                }
                              />
                              <Avatar
                                src={photographer.avatar}
                                initials={photographer.name[0]}
                                className="w-8 h-8 rounded-full"
                              />
                              <span className="text-sm font-medium">{photographer.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <label className="flex items-center gap-2 px-4 py-3 border-t border-border/60 text-sm text-muted-foreground">
                      <Checkbox
                        checked={draftFilters.unassignedOnly}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, unassignedOnly: Boolean(value) }))
                        }
                      />
                      Unassigned only
                    </label>
                  </div>
                </section>}

                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Services</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {serviceOptions.map(({ key: serviceKey, label: serviceLabel }) => {
                      const active = draftFilters.services.includes(serviceKey);
                      const label = serviceLabel || SERVICE_LABELS[serviceKey] || serviceKey.replace(/_/g, ' ');
                      return (
                        <button
                          key={serviceKey}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                            active
                              ? 'bg-primary/10 border-primary/40 text-primary'
                              : 'border-border text-muted-foreground',
                          )}
                          onClick={() =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              services: active
                                ? prev.services.filter((s) => s !== serviceKey)
                                : [...prev.services, serviceKey],
                            }))
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                    {serviceOptions.length === 0 && (
                      <span className="text-sm text-muted-foreground">No services detected</span>
                    )}
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Date range</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {DATE_RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                          draftFilters.dateRange === option.value
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'border-border text-muted-foreground',
                        )}
                        onClick={() =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            dateRange: prev.dateRange === option.value ? null : option.value,
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {draftFilters.dateRange === 'custom' && (
                    <div className="mt-4">
                      <DateRangePicker
                        value={{
                          startDate: draftFilters.customRange.from,
                          endDate: draftFilters.customRange.to,
                        }}
                        onChange={({ startDate, endDate }) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            customRange: { from: startDate, to: endDate },
                          }))
                        }
                      />
                    </div>
                  )}
                </section>

                <section>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Priority & flags</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.flaggedOnly}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, flaggedOnly: Boolean(value) }))
                        }
                      />
                      Only flagged
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.highPriority}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, highPriority: Boolean(value) },
                          }))
                        }
                      />
                      High priority
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.missingRaw}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, missingRaw: Boolean(value) },
                          }))
                        }
                      />
                      Missing RAW
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={draftFilters.priority.missingEditor}
                        onCheckedChange={(value) =>
                          setDraftFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, missingEditor: Boolean(value) },
                          }))
                        }
                      />
                      Missing editor
                    </label>
                  </div>
                </section>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-5">
                <Button variant="ghost" className="flex-1" onClick={cancelFilters}>
                  Cancel
                </Button>
                <Button variant="outline" className="flex-1" onClick={resetFilters}>
                  Reset all filters
                </Button>
                <Button className="flex-1" onClick={applyFilters}>
                  Apply filters
                </Button>
              </div>
            </div>
          </div>
        </div>,
        filterPanelHostRef.current,
      )}

      <div ref={filterPanelHostRef} />

      {/* Requested lists size to their content; only long lists own a bounded scroll area. */}
      <div className={cn('flex flex-col', activeTab === 'upcoming' && 'flex-1')}>
        {activeTab === 'upcoming' ? (
          paginatedGroups.length === 0 ? (
            <div
              data-shoots-empty="true"
              className="flex-1 w-full min-h-[120px] flex items-center justify-center text-center text-sm text-slate-500"
            >
              No upcoming shoots found.
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto hidden-scrollbar pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0"
              style={{ maxHeight: listMaxHeight }}
            >
              <div className="pointer-events-none sticky top-0 z-20 -mx-2 flex h-0 justify-end px-2">
                {renderStickyCompactToggle()}
              </div>
              {paginatedGroups.map((group, groupIndex) => (
                <div key={group.label} className={cn('space-y-3', groupIndex > 0 && 'mt-6')}>
                  <div
                    className={cn(
                      'flex items-center justify-between gap-2',
                      (groupIndex === 0 || group.shoots.length > 7) && 'sticky top-0 z-10 -mx-2 bg-card px-2 py-0.5'
                    )}
                  >
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
            <div className="min-h-[120px] flex items-center justify-center text-center text-sm text-slate-500 pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0">
              No pending requests.
            </div>
          ) : (
            <div 
              className="overflow-y-auto hidden-scrollbar pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0"
              style={{ maxHeight: listMaxHeight }}
            >
              <div className="pointer-events-none sticky top-0 z-20 -mx-2 flex h-0 justify-end px-2">
                {renderStickyCompactToggle()}
              </div>
              {requestedGroups.map((group, groupIndex) => (
                <div key={group.label} className={cn('space-y-3', groupIndex > 0 && 'mt-6')}>
                  <div
                    className={cn(
                      'flex items-center justify-between gap-2',
                      (groupIndex === 0 || group.shoots.length > 7) && 'sticky top-0 z-10 -mx-2 bg-card px-2 py-0.5'
                    )}
                  >
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-blue-500/20 to-transparent py-1 pl-2 pr-8">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <p className="text-xs font-semibold text-muted-foreground">
                        {getRelativeGroupLabel(group)}
                      </p>
                    </div>
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
