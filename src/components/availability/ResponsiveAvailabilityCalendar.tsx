import { lazy, Suspense, useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  Ban,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import {
  buildSelectedDateAvailabilities,
  type SlotSelectorDeps,
} from "@/lib/availability/selectors";
import type { Availability, Photographer } from "@/types/availability";
import { cn } from "@/lib/utils";
import { AvailabilityAvatarStack } from "./AvailabilityAvatarStack";
import {
  AvailabilityDayCards,
  type CalendarFilters,
} from "./AvailabilityDayCards";
import { freeDuration, photographerDay, summarizeDays } from "./calendarModel";
import "./responsiveAvailability.css";

const AvailabilityScheduleMap = lazy(() => import("./AvailabilityScheduleMap"));
type ViewMode = "day" | "week" | "month";
interface Props {
  date: Date;
  viewMode: ViewMode;
  photographers: Photographer[];
  selectedPhotographer: string;
  slots: SlotSelectorDeps;
  canSelect: boolean;
  canEdit: boolean;
  loading: boolean;
  error?: string;
  searchQuery: string;
  formatTime: (time: string) => string;
  onDate: (date: Date) => void;
  onView: (view: ViewMode) => void;
  onSelect: (id: string) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onAdd: () => void;
  onBlock: (personId?: string, from?: string, to?: string) => void;
  onManage: (id?: string) => void;
  onDefault: () => void;
  onSync: () => void;
  onRetry: () => void;
  onShoot: (id: number) => void;
  onEdit: (slot: Availability) => void;
}
export function ResponsiveAvailabilityCalendar(props: Props) {
  const {
    date,
    viewMode,
    photographers,
    selectedPhotographer,
    slots,
    canSelect,
    canEdit,
    loading,
    error,
    searchQuery,
    formatTime,
    onDate,
    onView,
    onSelect,
    onNavigate,
    onToday,
    onAdd,
    onBlock,
    onManage,
    onDefault,
    onSync,
    onRetry,
    onShoot,
    onEdit,
  } = props;
  const [pickerOpen, setPickerOpen] = useState(false),
    [pickerSearch, setPickerSearch] = useState("");
  const [mapOpen, setMapOpen] = useState(false),
    [datePickerOpen, setDatePickerOpen] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>({
    open: true,
    booked: true,
    blocked: true,
  });
  const team = selectedPhotographer === "all";
  const selected = photographers.find((p) => p.id === selectedPhotographer);
  const group = useMemo(
    () =>
      photographers.filter(
        (p) =>
          (team || p.id === selectedPhotographer) &&
          (!team || p.name.toLowerCase().includes(searchQuery.toLowerCase())),
      ),
    [photographers, team, selectedPhotographer, searchQuery],
  );
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const monthDates = eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
  });
  const daysFor = (day: Date) => {
    const rows = buildSelectedDateAvailabilities(slots, day);
    return group.map((person) => photographerDay(person, rows));
  };
  const selectedDays = daysFor(date),
    summary = summarizeDays(selectedDays);
  const periodTitle =
    viewMode === "month"
      ? format(date, "MMMM yyyy")
      : viewMode === "week"
        ? `${format(week[0], "MMM d")} – ${format(week[6], "MMM d, yyyy")}`
        : format(date, "EEE, MMM d, yyyy");
  const openDay = (day: Date) => {
    onDate(day);
    onView("day");
    setMapOpen(false);
  };
  const details = (
    <section
      className="availability-selected-details"
      aria-label="Selected day schedule"
    >
      {viewMode !== "day" && (
        <div className="availability-section-title">
          <h2>{format(date, "EEE, MMM d")}</h2>
          <button onClick={() => openDay(date)}>
            Day view <ChevronRight />
          </button>
        </div>
      )}
      <div className="availability-day-summary">
        <span>
          <small>{team ? "Total team availability" : "Open time"}</small>
          <strong>
            {freeDuration(summary.freeMinutes)} <em>open</em>
          </strong>
        </span>
        <span>
          {summary.shoots} {summary.shoots === 1 ? "shoot" : "shoots"}
        </span>
      </div>
      <AvailabilityDayCards
        days={selectedDays}
        formatTime={formatTime}
        canEdit={canEdit}
        filters={filters}
        onBlock={onBlock}
        onShoot={onShoot}
        onEdit={onEdit}
        onManage={onManage}
      />
      <p className="availability-footnote">
        Open time excludes shoots and blocked time. Route feasibility is checked
        when scheduling a shoot.
      </p>
    </section>
  );
  return (
    <div
      className="availability-workspace"
      data-testid="availability-workspace"
    >
      <h1 className="sr-only">Photographer Availability</h1>
      <header className="availability-toolbar">
        <button
          className="availability-person-picker"
          onClick={() => {
            setPickerSearch("");
            setPickerOpen(true);
          }}
          disabled={!canSelect}
          aria-label="Choose photographers"
        >
          <Users />
          <span>
            {team ? "All photographers" : selected?.name || "My schedule"}
          </span>
          {canSelect && <ChevronDown />}
        </button>
        {canEdit && (
          <button
            className="availability-block-button"
            onClick={() => onBlock()}
            aria-label="Block time"
          >
            <Ban />
            <span>Block</span>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="availability-icon-button"
              aria-label="Calendar tools"
            >
              <MoreHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {canEdit && (
              <>
                <DropdownMenuItem onSelect={onAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add schedule
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onManage()}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Manage schedules
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onDefault}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Default schedule
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => setMapOpen((value) => !value)}>
              <MapPin className="mr-2 h-4 w-4" />
              {mapOpen ? "Calendar view" : "Map for selected day"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onSync}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Calendar sync
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Show in day details
            </DropdownMenuLabel>
            {(["open", "booked", "blocked"] as const).map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={filters[key]}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(value) =>
                  setFilters((previous) => ({ ...previous, [key]: value }))
                }
              >
                {key === "open"
                  ? "Available time"
                  : key === "booked"
                    ? "Shoots"
                    : "Blocked time"}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {canEdit && (
          <button
            className="availability-add-button"
            onClick={onAdd}
            aria-label="Add schedule"
          >
            <Plus />
            <span>Add schedule</span>
          </button>
        )}
      </header>
      <div className="availability-calendar-shell">
        <div className="availability-navigation">
          <div className="availability-tabs" aria-label="Calendar view">
            {(["day", "week", "month"] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={viewMode === mode && !mapOpen}
                onClick={() => {
                  setMapOpen(false);
                  onView(mode);
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <div className="availability-period-navigation">
            <button
              className="availability-period-title"
              onClick={() => setDatePickerOpen(true)}
              aria-label={`Choose date, ${periodTitle}`}
            >
              {periodTitle}
              <ChevronDown />
            </button>
            <div className="availability-arrows">
              <button
                aria-label={`Previous ${viewMode}`}
                onClick={() => onNavigate(-1)}
              >
                <ChevronLeft />
              </button>
              <button
                aria-label={`Next ${viewMode}`}
                onClick={() => onNavigate(1)}
              >
                <ChevronRight />
              </button>
              <button className="availability-today" onClick={onToday}>
                Today
              </button>
            </div>
          </div>
        </div>
        {loading ? (
          <div role="status" className="availability-loading">
            <InlineSpinner />
            Loading schedules…
          </div>
        ) : error ? (
          <div role="alert" className="availability-error">
            <p>{error}</p>
            <button onClick={onRetry}>Retry</button>
          </div>
        ) : !group.length ? (
          <div className="availability-empty">
            <Users />
            <h2>
              {searchQuery
                ? "No matching photographers"
                : "No photographers available"}
            </h2>
            <p>
              {searchQuery
                ? "Try a different name in the page search."
                : "Add a photographer account to begin scheduling."}
            </p>
          </div>
        ) : mapOpen ? (
          <Suspense
            fallback={
              <div className="availability-loading">
                <InlineSpinner />
              </div>
            }
          >
            <AvailabilityScheduleMap
              days={selectedDays}
              onShoot={onShoot}
              formatTime={formatTime}
            />
          </Suspense>
        ) : (
          <div
            className={`availability-calendar-content availability-view-${viewMode}`}
          >
            {viewMode === "day" && (
              <>
                <div className="availability-day-strip">
                  {week.map((day) => (
                    <button
                      key={format(day, "yyyy-MM-dd")}
                      aria-label={format(day, "EEEE, MMMM d")}
                      aria-pressed={isSameDay(day, date)}
                      onClick={() => onDate(day)}
                    >
                      <small>{format(day, "EEEEE")}</small>
                      <strong>{format(day, "d")}</strong>
                    </button>
                  ))}
                </div>
                {details}
              </>
            )}
            {viewMode === "week" && (
              <>
                <div className="availability-section-title">
                  <h2>
                    {team
                      ? "Team availability"
                      : `${selected?.name || "Your"} availability`}
                  </h2>
                  <span>Select a day</span>
                </div>
                <div className="availability-week-cards">
                  {week.map((day) => {
                    const people = daysFor(day),
                      stats = summarizeDays(people);
                    return (
                      <button
                        className={cn(
                          "availability-week-card",
                          isSameDay(day, date) && "is-selected",
                        )}
                        key={format(day, "yyyy-MM-dd")}
                        onClick={() => openDay(day)}
                        aria-label={`Open ${format(day, "EEE, MMM d")} schedule`}
                      >
                        <div className="availability-week-card-top">
                          <span className="availability-week-date">
                            <small>{format(day, "EEE")}</small>
                            <strong>{format(day, "d")}</strong>
                          </span>
                          <span className="availability-week-summary">
                            <strong>
                              {stats.configured
                                ? team
                                  ? `${stats.peopleFree} ${stats.peopleFree === 1 ? "photographer" : "photographers"} free`
                                  : `${freeDuration(stats.freeMinutes)} open`
                                : "No working hours"}
                            </strong>
                            <small>
                              {stats.shoots} scheduled{" "}
                              {stats.shoots === 1 ? "shoot" : "shoots"}
                            </small>
                          </span>
                          <ChevronRight />
                        </div>
                        {team && (
                          <div className="availability-week-card-bottom">
                            <AvailabilityAvatarStack
                              photographers={people
                                .filter((p) =>
                                  p.free.some((w) => w.end - w.start >= 60),
                                )
                                .map((p) => p.photographer)}
                            />
                            <small>
                              {freeDuration(stats.freeMinutes)} total open
                            </small>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="availability-footnote">
                  “Free” means at least one continuous hour of open time.
                </p>
              </>
            )}
            {viewMode === "month" && (
              <div className="availability-month-layout">
                <div className="availability-month-panel">
                  <div className="availability-section-title">
                    <h2>
                      {team ? "Team availability" : "Monthly availability"}
                    </h2>
                    <span>Tap a date</span>
                  </div>
                  <div className="availability-month-calendar">
                    <div className="availability-weekdays">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                        (day) => (
                          <span key={day}>
                            <abbr title={day}>{day[0]}</abbr>
                            <span>{day}</span>
                          </span>
                        ),
                      )}
                    </div>
                    <div className="availability-month-dates">
                      {monthDates.map((day) => {
                        const outside = !isSameMonth(day, date),
                          stats = outside ? null : summarizeDays(daysFor(day));
                        return (
                          <button
                            key={format(day, "yyyy-MM-dd")}
                            className={cn(
                              "availability-month-date",
                              outside && "is-outside",
                              stats && !stats.configured && "is-off",
                            )}
                            disabled={outside}
                            aria-pressed={isSameDay(day, date)}
                            onClick={() => onDate(day)}
                            aria-label={`${format(day, "EEE, MMM d")}, ${stats ? `${team ? stats.peopleFree + " photographers free" : freeDuration(stats.freeMinutes) + " open"}, ${stats.shoots} shoots` : "outside month"}`}
                          >
                            <strong>{format(day, "d")}</strong>
                            {stats && (
                              <>
                                <small
                                  className={
                                    stats.freeMinutes ? "has-time" : ""
                                  }
                                >
                                  {!stats.configured
                                    ? "—"
                                    : team
                                      ? `${stats.peopleFree} free`
                                      : freeDuration(stats.freeMinutes, true)}
                                </small>
                                <span
                                  className={stats.shoots ? "has-shoots" : ""}
                                >
                                  {stats.shoots ? (
                                    <>
                                      <Camera />
                                      {stats.shoots}
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="availability-month-legend">
                    <span>
                      <i />
                      {team ? "People with 1h+ free" : "Open hours"}
                    </span>
                    <span>
                      <Camera />
                      Shoots
                    </span>
                  </div>
                </div>
                {details}
              </div>
            )}
          </div>
        )}
      </div>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="availability-dialog">
          <DialogHeader>
            <DialogTitle>Choose photographers</DialogTitle>
            <DialogDescription>
              Keep your selected date while switching between the team and an
              individual.
            </DialogDescription>
          </DialogHeader>
          <label className="availability-picker-search">
            <Search />
            <input
              aria-label="Search photographers"
              placeholder="Search photographers"
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
            />
          </label>
          <div className="availability-picker-list">
            {[
              { id: "all", name: "All photographers" },
              ...photographers.filter((p) =>
                p.name.toLowerCase().includes(pickerSearch.toLowerCase()),
              ),
            ].map((p) => (
              <button
                key={p.id}
                aria-label={p.name}
                aria-pressed={p.id === selectedPhotographer}
                onClick={() => {
                  onSelect(p.id);
                  setPickerOpen(false);
                }}
              >
                {p.id === "all" ? (
                  <Users />
                ) : (
                  <AvailabilityAvatarStack photographers={[p]} />
                )}
                <span>{p.name}</span>
                {p.id === selectedPhotographer && (
                  <span className="availability-selected-label">Selected</span>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <DialogContent className="availability-dialog">
          <DialogHeader>
            <DialogTitle>Go to date</DialogTitle>
            <DialogDescription>
              Jump to another day, week or month.
            </DialogDescription>
          </DialogHeader>
          <input
            type="date"
            aria-label="Go to date"
            className="h-12 w-full rounded-xl border bg-background px-3"
            value={format(date, "yyyy-MM-dd")}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                onDate(new Date(e.target.value + "T12:00:00"));
                setDatePickerOpen(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
