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

export function EditingManagerShootsTabsView({ model }: { model: ReturnType<typeof useShootsTabsCardController> }) {
  const {
    title,
    showAssignmentFilters,
    activeTab,
    setActiveTab,
    filters,
    draftFilters,
    setDraftFilters,
    isFilterOpen,
    setIsFilterOpen,
    showPastDays,
    setShowPastDays,
    isMenuOpen,
    setIsMenuOpen,
    isCompactMobile,
    setIsCompactMobile,
    scrollContainerRef,
    loadMoreSentinelRef,
    filterPanelHostRef,
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
    editingManagerHasPastDays,
    editingManagerPaginatedGroups,
    editingManagerHasMore,
    handleScroll,
    loadMoreShoots,
    listMaxHeight,
    renderShootCard,
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
      <Card className="flex flex-col h-full flex-1 relative">
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="sm:hidden absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors text-muted-foreground"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <ChevronsDown size={16} /> : <MoreVertical size={16} />}
        </button>

        <div className="flex flex-wrap items-center justify-between mb-2 gap-3 pr-10 sm:pr-0">
          <div className="flex items-center gap-4">
            <h2 className="hidden sm:block text-lg font-bold text-foreground">{title}</h2>
            <div className="flex items-center gap-1 border-b border-transparent pl-1 sm:pl-0">
              {editingManagerTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all border-b-2 whitespace-nowrap',
                    activeTab === tab.id
                      ? 'text-foreground border-primary'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  )}
                >
                  {tab.label} ({tab.shoots.length})
                </button>
              ))}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastDays((prev) => !prev)}
              disabled={!editingManagerHasPastDays}
            >
              <span className="max-[1550px]:hidden">
                {editingManagerHasPastDays ? (showPastDays ? 'Hide past' : 'Previous shoots') : 'Previous shoots'}
              </span>
              <span className="hidden max-[1550px]:inline">
                {editingManagerHasPastDays && showPastDays ? 'Hide' : 'Previous'}
              </span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 max-[1550px]:px-2"
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
                <span className="hidden max-[1550px]:inline ml-1 text-[10px] font-semibold">
                  ({activeFilterCount})
                </span>
              )}
            </Button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="sm:hidden flex items-center gap-2 mb-3 -mt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-full border-dashed"
              onClick={() => setShowPastDays((prev) => !prev)}
              disabled={!editingManagerHasPastDays}
            >
              {editingManagerHasPastDays ? (showPastDays ? 'Hide past' : 'Previous shoots') : 'Previous shoots'}
            </Button>
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

        <div className="flex-1 flex flex-col">
          {editingManagerPaginatedGroups.length === 0 ? (
            <div
              data-shoots-empty="true"
              className="flex-1 w-full min-h-[120px] flex items-center justify-center text-center text-sm text-slate-500"
            >
              {activeEditingManagerTab?.emptyStateText || 'No shoots found.'}
            </div>
          ) : (
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 space-y-6 overflow-y-auto hidden-scrollbar pb-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] sm:pb-0"
              style={{ maxHeight: listMaxHeight }}
            >
              {editingManagerPaginatedGroups.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div
                    className={cn(
                      group.shoots.length > 7 && 'sticky top-0 z-10 -mx-2 bg-card px-2 py-0.5'
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
              {editingManagerHasMore && (
                <div
                  ref={loadMoreSentinelRef}
                  className="flex justify-center py-2"
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
