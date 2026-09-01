import { useState } from 'react';
import { format, parse } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ServiceSelectionDialog,
  type ServiceSelectionOption,
} from '@/components/booking/ServiceSelectionDialog';
import {
  buildServiceTimeOptions,
  ServiceDatePicker,
  ServiceTimePicker,
} from '@/components/shoots/ServiceSchedulePicker';
import type { ShootData } from '@/types/shoots';
import type { NormalizedShootServiceItem } from '@/utils/shootServiceItems';
import { normalizeShootServiceCategoryKey } from '@/utils/shootPhotographerAssignments';
import {
  formatDateForWallClockInput,
  formatTimeForWallClockInput,
} from '@/utils/wallClockDateTime';
import { to12Hour } from '@/utils/availabilityUtils';
import type {
  PhotographerPickerOption,
  ServiceOption,
} from './useShootOverviewEditor';
import type { ComplimentarySourceServiceOption } from './useComplimentaryServiceMode';
import { CompServiceModeControls } from '@/features/complimentary-reshoots/CompServiceModeControls';
import type { CompReshootReasonCode } from '@/features/complimentary-reshoots/model';
import {
  deriveRowStatuses,
  STATUS_DOT_CLASS,
  type ServiceRowStatus,
} from './overviewServiceStatus';

export type { ServiceRowStatus };

export type OverviewServicesTableSectionProps = {
  isEditMode: boolean;
  shoot: ShootData;

  // Read-only data source (one row per item).
  // serviceItems = getShootServiceItems(shoot), computed by the parent and passed in.
  serviceItems: NormalizedShootServiceItem[];

  // Edit-mode data
  servicesList: ServiceOption[];
  selectedServiceIds: string[];
  serviceSchedules: Record<string, { date: string; time: string }>;
  effectiveSqft: number | null;

  // Per-row photographer assignment (edit mode)
  editModePhotographerRows: Array<{
    key: string;
    name: string;
    photographer?: { id?: string | number; name?: string; email?: string } | null;
  }>;
  perCategoryPhotographers: Record<string, string>;
  selectedPhotographerIdEdit: string;
  resolvePhotographerDetails: (
    id?: string | null,
  ) => PhotographerPickerOption | { name?: string; email?: string } | null | undefined;

  // Actions (all from useShootOverviewEditor)
  toggleServiceSelection: (serviceId: string) => void;
  updateServiceSchedule: (serviceId: string, field: 'date' | 'time', value: string) => void;
  openEditPhotographerPicker: (context: {
    source: 'edit';
    categoryKey?: string;
    categoryName?: string;
    complimentarySourceServiceId?: string;
  }) => void;

  // Price + label formatting (from the parent composer)
  getServiceDisplayPrice: (service: ServiceOption) => string;
  getReadonlyServiceDisplayPrice: (service: unknown) => string;
  formatServiceLabel: (service: unknown) => string;

  // Service picker dialog plumbing (existing ServiceSelectionDialog)
  serviceDialogOpen: boolean;
  setServiceDialogOpen: (open: boolean) => void;
  serviceModalSearch: string;
  setServiceModalSearch: (value: string) => void;
  servicePanelCategory: string;
  setServicePanelCategory: (categoryId: string) => void;
  panelServices: ServiceOption[];

  // Role flags affecting visibility of e.g. photographer email
  isClient: boolean;
  isPhotographer: boolean;
  isEditor: boolean;
  isAdmin?: boolean;
  complimentary?: {
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    sourceServices: ComplimentarySourceServiceOption[];
    selectedSourceServiceIds: string[];
    schedules: Record<string, { date: string; time: string }>;
    photographerIds: Record<string, string>;
    reasonCode: CompReshootReasonCode | '';
    onReasonCodeChange: (reason: CompReshootReasonCode) => void;
    reasonNote: string;
    onReasonNoteChange: (note: string) => void;
    clientPays: boolean;
    onClientPaysChange: (enabled: boolean) => void;
    payPhotographer: boolean;
    onPayPhotographerChange: (enabled: boolean) => void;
    paySalesRep: boolean;
    onPaySalesRepChange: (enabled: boolean) => void;
    hasSalesRep: boolean;
    toggleServiceSelection: (sourceShootServiceId: string) => void;
    updateServiceSchedule: (sourceShootServiceId: string, field: 'date' | 'time', value: string) => void;
  };
};

// Placeholder shown in Date/Time/Photographer/Price cells when the underlying
// value is absent (UNASSIGNED). Both date/time and photographer use "N/A".
const UNASSIGNED = 'Unassigned';
const NOT_ASSIGNED = 'Unassigned';

// Column definitions. The Services column is intentionally given no fixed width
// so that (with `table-fixed` in read-only mode) it absorbs the remaining space
// and shows as much of the service name as possible. Price is right-aligned and
// sits in the final column at the extreme right edge.
const BASE_HEADER_CELLS = [
  { label: 'Services', className: '' },
  { label: 'Date', className: 'w-[74px]' },
  { label: 'Time', className: 'w-[58px]' },
] as const;

type HeaderCell = {
  label: string;
  className: string;
};

const isPayView = (props: Pick<OverviewServicesTableSectionProps, 'isPhotographer' | 'isEditor'>) =>
  props.isPhotographer || props.isEditor;

const getHeaderCells = (
  props: Pick<OverviewServicesTableSectionProps, 'isPhotographer' | 'isEditor'>,
): HeaderCell[] => [
  ...BASE_HEADER_CELLS,
  ...(isPayView(props) ? [] : [{ label: 'Photographer', className: 'w-[92px]' }]),
  {
    label: isPayView(props) ? 'Pay' : 'Price',
    className: 'w-[66px] text-right pr-0',
  },
];

// Default schedule applied to a row that has no saved schedule yet, matching the
// fallback used by the existing services editor (empty date, 10:00 time).
const DEFAULT_ROW_SCHEDULE = { date: '', time: '10:00' };

const normalizeCategoryName = (value?: string) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'photo' || normalized === 'photos') return 'photos';
  return normalized;
};

/**
 * Mirrors `deriveServiceCategoryName` from `useShootOverviewEditor` so the row's
 * category key matches the keys used by `editModePhotographerRows` and
 * `perCategoryPhotographers`. Kept local to keep this component presentational.
 */
const deriveServiceCategoryName = (service: ServiceOption): string => {
  const categoryName =
    typeof service.category === 'string' ? service.category : service.category?.name;
  const normalizedName = normalizeCategoryName(categoryName);
  if (normalizedName === 'photos') return 'Photos';
  if (!service.category) return 'Uncategorized';
  if (typeof service.category === 'string') return service.category;
  return service.category.name || 'Uncategorized';
};

/**
 * Formats a service's `scheduledAt` into a human-readable date (e.g. "Jan 5, 2025"),
 * using wall-clock semantics. Returns null when there is no parseable date.
 */
const formatDisplayDate = (value?: string | null): string | null => {
  const wallClockDate = formatDateForWallClockInput(value);
  if (!wallClockDate) return null;
  try {
    const parsed = parse(wallClockDate, 'yyyy-MM-dd', new Date());
    if (Number.isNaN(parsed.getTime())) return null;
    return format(parsed, 'MMM d, yyyy');
  } catch {
    return null;
  }
};

/**
 * Formats a service's `scheduledAt` into a 12-hour time (e.g. "10:00 AM").
 * Returns null when there is no parseable time.
 */
const formatDisplayTime = (value?: string | null): string | null => {
  const wallClockTime = formatTimeForWallClockInput(value);
  if (!wallClockTime) return null;
  return to12Hour(wallClockTime) || null;
};

export function OverviewServicesTableSection(
  props: OverviewServicesTableSectionProps,
): JSX.Element {
  const {
    isEditMode,
    servicesList,
    selectedServiceIds,
    serviceDialogOpen,
    setServiceDialogOpen,
    toggleServiceSelection,
    effectiveSqft,
    complimentary,
  } = props;

  // Ephemeral UI state: tracks which row's Services cell opened the picker so the
  // change-service flow is routed to a single row. `null` means the "Add New" flow.
  const [editingServiceRowId, setEditingServiceRowId] = useState<string | null>(null);
  const headerCells = getHeaderCells(props);

  const dialogServices = complimentary?.enabled ? complimentary.sourceServices : servicesList;
  const dialogSelectedIds = complimentary?.enabled
    ? complimentary.selectedSourceServiceIds
    : selectedServiceIds;
  const selectedServicesForDialog = dialogServices.filter((service) =>
    dialogSelectedIds.includes(String(service.id)),
  );
  const canRemoveAllServices = Boolean(
    props.shoot.canRemoveAllServices ?? props.shoot.can_remove_all_services,
  );

  // Apply the dialog's multi-select result back to the editor by diffing against
  // the currently selected ids (matches the existing OverviewServicesSection flow).
  const handleSelectedServicesChange = (nextServices: ServiceSelectionOption[]) => {
    if (complimentary?.enabled) {
      const currentIds = new Set(complimentary.selectedSourceServiceIds.map(String));
      const nextIds = new Set(nextServices.map((service) => String(service.id)));

      complimentary.selectedSourceServiceIds.forEach((sourceShootServiceId) => {
        if (!nextIds.has(sourceShootServiceId)) {
          complimentary.toggleServiceSelection(sourceShootServiceId);
        }
      });
      nextServices.forEach((service) => {
        const sourceShootServiceId = String(service.id);
        if (!currentIds.has(sourceShootServiceId)) {
          complimentary.toggleServiceSelection(sourceShootServiceId);
        }
      });
      return;
    }

    if (nextServices.length === 0 && !canRemoveAllServices) return;
    const currentIds = new Set(selectedServiceIds.map(String));
    const nextIds = new Set(nextServices.map((service) => String(service.id)));

    selectedServiceIds.forEach((serviceId) => {
      if (!nextIds.has(String(serviceId))) {
        toggleServiceSelection(String(serviceId));
      }
    });

    nextServices.forEach((service) => {
      const serviceId = String(service.id);
      if (!currentIds.has(serviceId)) {
        toggleServiceSelection(serviceId);
      }
    });
  };

  const openServiceDialog = (rowId: string | null, complimentaryMode?: boolean) => {
    if (complimentary && complimentaryMode !== undefined) {
      complimentary.onEnabledChange(complimentaryMode);
    }
    setEditingServiceRowId(rowId);
    setServiceDialogOpen(true);
  };

  const handleCompModeChange = (enabled: boolean) => {
    setEditingServiceRowId(null);
    complimentary?.onEnabledChange(enabled);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setEditingServiceRowId(null);
    }
    setServiceDialogOpen(open);
  };

  return (
    <div className="p-2.5 border rounded-lg bg-card">
      <div className="overflow-visible">
        <table
          className={`w-full text-[11px] ${isEditMode ? 'block sm:table' : 'table-fixed'}`}
        >
          <thead className={isEditMode ? 'hidden sm:table-header-group' : undefined}>
            <tr className="text-left text-[11px] font-semibold uppercase text-muted-foreground">
              {/* Leading narrow column for the Delete_Control (edit mode only). In
                  read-only mode the status dot is rendered inside the Services
                  cell and offset outside the card on the left. */}
              {isEditMode && <th scope="col" className="w-5 pb-1.5" aria-label="Actions" />}
              {headerCells.map(({ label, className }) => (
                <th key={label} scope="col" className={`pb-1.5 pr-1.5 font-medium ${className}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isEditMode ? 'block sm:table-row-group' : undefined}>
            {isEditMode
              ? renderEditRows(props, openServiceDialog)
              : renderReadonlyRows(props)}
          </tbody>
        </table>
      </div>
      {isEditMode && (
        <ServiceSelectionDialog
          open={serviceDialogOpen}
          onOpenChange={handleDialogOpenChange}
          services={dialogServices}
          selectedServices={selectedServicesForDialog}
          onSelectedServicesChange={handleSelectedServicesChange}
          effectiveSqft={effectiveSqft}
          allowEmptySelection={Boolean(complimentary?.enabled) || canRemoveAllServices}
          compact={Boolean(complimentary?.enabled)}
          title={complimentary?.enabled
            ? 'Select return-visit services'
            : editingServiceRowId ? 'Change service' : 'Add services'}
          description={complimentary?.enabled
            ? 'Choose what needs to be redone and who should be paid.'
            : undefined}
          contextualControls={complimentary ? (
            <CompServiceModeControls
              enabled={complimentary.enabled}
              onEnabledChange={handleCompModeChange}
              reasonCode={complimentary.reasonCode}
              onReasonCodeChange={complimentary.onReasonCodeChange}
              reasonNote={complimentary.reasonNote}
              onReasonNoteChange={complimentary.onReasonNoteChange}
              clientPays={complimentary.clientPays}
              onClientPaysChange={complimentary.onClientPaysChange}
              payPhotographer={complimentary.payPhotographer}
              onPayPhotographerChange={complimentary.onPayPhotographerChange}
              paySalesRep={complimentary.paySalesRep}
              onPaySalesRepChange={complimentary.onPaySalesRepChange}
              hasSalesRep={complimentary.hasSalesRep}
            />
          ) : undefined}
          renderServicePrice={complimentary?.enabled
            ? (_service, defaultLabel) => (complimentary.clientPays ? defaultLabel : '$0')
            : undefined}
          selectionSummary={complimentary?.enabled
            ? `${complimentary.selectedSourceServiceIds.length} selected · ${complimentary.clientPays ? 'Client billed' : 'Client $0'}`
            : undefined}
        />
      )}
    </div>
  );
}

/**
 * Read-only rendering: one row per `serviceItems` entry, each with a leading
 * Status_Dot, the service label, date/time, photographer, and individual price.
 * Renders a single "No services" empty-state cell when there are no items.
 */
function renderReadonlyRows(props: OverviewServicesTableSectionProps) {
  const { serviceItems, formatServiceLabel, getReadonlyServiceDisplayPrice } = props;
  const headerCells = getHeaderCells(props);
  const showPhotographerColumn = !isPayView(props);

  if (serviceItems.length === 0) {
    return (
      <tr>
        <td colSpan={headerCells.length} className="py-3 text-center text-muted-foreground">
          No services
        </td>
      </tr>
    );
  }

  const statuses = deriveRowStatuses(serviceItems);

  return serviceItems.map((item) => {
    const status: ServiceRowStatus = statuses.get(item.id) ?? 'unfinished';
    const dotClass = STATUS_DOT_CLASS[status];
    const dateDisplay = formatDisplayDate(item.scheduledAt);
    const timeDisplay = formatDisplayTime(item.scheduledAt);
    const label = formatServiceLabel(item.source) || item.name;
    const source = item.source;
    const sourceItemId = String(item.shootServiceId || item.id);
    const linkedResponsibility = (props.shoot.reshootServiceLinks ?? props.shoot.reshoot_service_links ?? []).find((link) => (
      String(link.reshootShootServiceId ?? link.reshoot_shoot_service_id ?? '') === sourceItemId
    ));
    const responsibility = source.reshootResponsibility
      ?? source.reshoot_responsibility
      ?? linkedResponsibility?.responsibility
      ?? null;
    const responsibilityLabel = responsibility
      ? String(responsibility).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : null;
    const sourceServiceName = source.sourceServiceName
      ?? source.source_service_name
      ?? linkedResponsibility?.sourceService?.name
      ?? linkedResponsibility?.source_service?.name
      ?? linkedResponsibility?.sourceServiceName
      ?? linkedResponsibility?.source_service_name
      ?? null;

    return (
      <tr key={item.id} className="align-middle">
        <td className="relative py-1.5 pr-2">
          <span
            data-testid="status-dot"
            data-status={status}
            className={`absolute -left-4 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full ${dotClass}`}
            aria-hidden="true"
          />
          <span className="block truncate font-medium text-foreground">{label}</span>
          {props.isAdmin && responsibilityLabel && (
            <span className="block truncate text-[10px] font-medium text-amber-700 dark:text-amber-300">
              Reshoot responsibility: {responsibilityLabel}
            </span>
          )}
          {sourceServiceName && (
            <span className="block truncate text-[10px] text-muted-foreground">From: {sourceServiceName}</span>
          )}
        </td>
        <td className="py-1.5 pr-2 whitespace-nowrap">
          {dateDisplay ?? <span className="text-muted-foreground">{UNASSIGNED}</span>}
        </td>
        <td className="py-1.5 pr-2 whitespace-nowrap">
          {timeDisplay ?? <span className="text-muted-foreground">{UNASSIGNED}</span>}
        </td>
        {showPhotographerColumn && (
          <td className="py-1.5 pr-2">
            {item.photographerName ? (
              <span className="block truncate">{item.photographerName}</span>
            ) : (
              <span className="text-muted-foreground">{NOT_ASSIGNED}</span>
            )}
          </td>
        )}
        <td className="py-1.5 pl-1.5 whitespace-nowrap text-right font-medium text-muted-foreground">
          {getReadonlyServiceDisplayPrice(item.source)}
        </td>
      </tr>
    );
  });
}

/**
 * Edit-mode rendering: one row per `selectedServiceIds` entry resolved through
 * `servicesList` (ids not found are skipped). Each row renders a red-square
 * Delete_Control, a Services button that opens the picker to change that row's
 * service, inline date/time pickers, a Photographer button that opens the picker
 * for that row's category, and the row's price. An "Add New" link follows the
 * rows; an empty selection renders the empty-state cell (plus the "Add New" link).
 */
function renderEditRows(
  props: OverviewServicesTableSectionProps,
  openServiceDialog: (rowId: string | null, complimentaryMode?: boolean) => void,
) {
  const {
    shoot,
    servicesList,
    selectedServiceIds,
    serviceSchedules,
    perCategoryPhotographers,
    selectedPhotographerIdEdit,
    resolvePhotographerDetails,
    toggleServiceSelection,
    updateServiceSchedule,
    openEditPhotographerPicker,
    getServiceDisplayPrice,
    isClient,
    complimentary,
  } = props;
  const headerCells = getHeaderCells(props);
  const showPhotographerColumn = !isPayView(props);
  const canRemoveAllServices = Boolean(
    shoot.canRemoveAllServices ?? shoot.can_remove_all_services,
  );
  const mobileEditRowClass = [
    'mb-2 grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-2 rounded-lg border p-2',
    'last:mb-0 sm:mb-0 sm:table-row sm:border-0 sm:p-0',
  ].join(' ');

  const addNewRow = (
    <tr key="__add_new__" className="block sm:table-row">
      <td colSpan={headerCells.length + 1} className="block pt-2 sm:table-cell">
        <button
          type="button"
          data-testid="add-new-service"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          onClick={() => openServiceDialog(null)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add New
        </button>
      </td>
    </tr>
  );

  if (selectedServiceIds.length === 0 && !complimentary?.selectedSourceServiceIds.length) {
    return [
      <tr key="__empty__" className="block sm:table-row">
        <td
          colSpan={headerCells.length + 1}
          className="block py-3 text-center text-muted-foreground sm:table-cell"
        >
          No services
        </td>
      </tr>,
      addNewRow,
    ];
  }

  const serviceRows = selectedServiceIds
    .map((serviceId) => {
      const service = servicesList.find(
        (serviceOption) => String(serviceOption.id) === String(serviceId),
      );
      if (!service) return null;

      const schedule = serviceSchedules[serviceId] ?? DEFAULT_ROW_SCHEDULE;
      const categoryName = deriveServiceCategoryName(service);
      const categoryKey = normalizeShootServiceCategoryKey(categoryName);
      const photographer = resolvePhotographerDetails(
        perCategoryPhotographers[categoryKey] ?? selectedPhotographerIdEdit,
      );

      return (
        <tr key={serviceId} className={`${mobileEditRowClass} align-middle`}>
          <td className="col-start-1 row-start-1 flex items-center py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <button
              type="button"
              data-testid="delete-control"
              aria-label={`Remove ${service.name}`}
              className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-red-500 text-white hover:bg-red-600"
              disabled={selectedServiceIds.length === 1 && !canRemoveAllServices}
              title={selectedServiceIds.length === 1 && !canRemoveAllServices
                ? 'At least one service is required for your role.'
                : undefined}
              onClick={() => toggleServiceSelection(serviceId)}
            >
              <X className="h-3 w-3" />
            </button>
          </td>
          <td className="col-span-2 col-start-2 row-start-1 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <button
              type="button"
              data-testid="service-cell"
              className="block w-full truncate text-left font-medium text-foreground hover:underline"
              onClick={() => openServiceDialog(serviceId, false)}
            >
              {service.name}
            </button>
          </td>
          <td className="col-span-2 col-start-1 row-start-2 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <ServiceDatePicker
              value={schedule.date}
              onChange={(value) => updateServiceSchedule(serviceId, 'date', value)}
              triggerClassName="h-8 w-full rounded-lg sm:w-auto"
            />
          </td>
          <td className="col-span-2 col-start-3 row-start-2 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <ServiceTimePicker
              value={schedule.time}
              options={buildServiceTimeOptions(schedule.time)}
              onChange={(value) => updateServiceSchedule(serviceId, 'time', value)}
              triggerClassName="h-8 w-full rounded-lg sm:w-auto"
            />
          </td>
          {showPhotographerColumn && (
            <td className="col-span-4 col-start-1 row-start-3 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="photographer-cell"
                className="h-8 w-full max-w-full justify-start text-xs sm:w-auto"
                onClick={() =>
                  openEditPhotographerPicker({
                    source: 'edit',
                    categoryKey,
                    categoryName,
                  })
                }
              >
                <span className="block min-w-0 truncate text-left">
                  <span className="block truncate">
                    {photographer?.name || NOT_ASSIGNED}
                  </span>
                  {!isClient && photographer?.email && (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {photographer.email}
                    </span>
                  )}
                </span>
              </Button>
            </td>
          )}
          <td className="col-start-4 row-start-1 block py-1 text-right font-medium text-muted-foreground sm:table-cell sm:py-1.5 sm:pl-1.5">
            {getServiceDisplayPrice(service)}
          </td>
        </tr>
      );
    })
    .filter((row): row is JSX.Element => row !== null);

  const compServiceRows = (complimentary?.selectedSourceServiceIds ?? [])
    .map((sourceShootServiceId) => {
      if (!complimentary) return null;
      const service = complimentary.sourceServices.find(
        (option) => option.sourceShootServiceId === sourceShootServiceId,
      );
      if (!service) return null;

      const schedule = complimentary.schedules[sourceShootServiceId] ?? DEFAULT_ROW_SCHEDULE;
      const categoryName = deriveServiceCategoryName(service);
      const categoryKey = normalizeShootServiceCategoryKey(categoryName);
      const photographerId = complimentary.photographerIds[sourceShootServiceId]
        || service.defaultPhotographerId
        || selectedPhotographerIdEdit;
      const photographer = resolvePhotographerDetails(photographerId);

      return (
        <tr
          key={`comp-${sourceShootServiceId}`}
          className={`${mobileEditRowClass} align-middle bg-primary/[0.035]`}
          data-testid={`comp-service-row-${sourceShootServiceId}`}
        >
          <td className="col-start-1 row-start-1 flex items-center py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <button
              type="button"
              aria-label={`Remove complimentary ${service.name}`}
              className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-red-500 text-white hover:bg-red-600"
              onClick={() => complimentary.toggleServiceSelection(sourceShootServiceId)}
            >
              <X className="h-3 w-3" />
            </button>
          </td>
          <td className="col-span-2 col-start-2 row-start-1 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <button
              type="button"
              className="block w-full truncate text-left font-medium text-foreground hover:underline"
              onClick={() => openServiceDialog(sourceShootServiceId, true)}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{service.name}</span>
                <Badge className="h-4 shrink-0 rounded-full border border-primary/20 bg-primary/10 px-1.5 text-[9px] font-semibold uppercase text-primary hover:bg-primary/10">
                  {complimentary.clientPays ? 'Additional' : 'Comp'}
                </Badge>
              </span>
            </button>
          </td>
          <td className="col-span-2 col-start-1 row-start-2 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <ServiceDatePicker
              value={schedule.date}
              onChange={(value) => complimentary.updateServiceSchedule(sourceShootServiceId, 'date', value)}
              triggerClassName="h-8 w-full rounded-lg sm:w-auto"
            />
          </td>
          <td className="col-span-2 col-start-3 row-start-2 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
            <ServiceTimePicker
              value={schedule.time}
              options={buildServiceTimeOptions(schedule.time)}
              onChange={(value) => complimentary.updateServiceSchedule(sourceShootServiceId, 'time', value)}
              triggerClassName="h-8 w-full rounded-lg sm:w-auto"
            />
          </td>
          {showPhotographerColumn && (
            <td className="col-span-4 col-start-1 row-start-3 block min-w-0 py-1 sm:table-cell sm:py-1.5 sm:pr-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full max-w-full justify-start bg-background text-xs sm:w-auto"
                onClick={() => openEditPhotographerPicker({
                  source: 'edit',
                  categoryKey,
                  categoryName,
                  complimentarySourceServiceId: sourceShootServiceId,
                })}
              >
                <span className="block min-w-0 truncate text-left">
                  <span className="block truncate">{photographer?.name || NOT_ASSIGNED}</span>
                  {!isClient && photographer?.email && (
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {photographer.email}
                    </span>
                  )}
                </span>
              </Button>
            </td>
          )}
          <td className="col-start-4 row-start-1 block py-1 text-right font-semibold text-primary sm:table-cell sm:py-1.5 sm:pl-1.5">
            {complimentary.clientPays ? getServiceDisplayPrice(service) : '$0'}
          </td>
        </tr>
      );
    })
    .filter((row): row is JSX.Element => row !== null);

  return [...serviceRows, ...compServiceRows, addNewRow];
}
