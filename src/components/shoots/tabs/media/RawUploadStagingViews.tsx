/**
 * Presentational pieces of the raw upload panel.
 *
 * RawUploadSection owns the state and the upload orchestration; everything here
 * only renders what it is handed. Splitting the render out keeps that file
 * within the project's 1000-line limit and makes each region of the panel
 * readable on its own: the counter strip, one service's staged group, and the
 * commit bar.
 */

import { ArrowRight, Camera, ChevronDown, ChevronRight, Loader2, Upload, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { UploadClassificationButtons } from './MediaUploadSharedComponents';
import {
  getQueueFileKey,
  RAW_STAGING_CLASSIFICATION_OPTIONS,
  type UploadQueueMediaType,
  type UploadServiceTarget,
} from './mediaUploadUtils';
import type { StagedUploadGroup } from './uploadGroups';

export interface RawUploadStat {
  key: string;
  label: string;
  value: number;
  alert?: boolean;
}

/**
 * One counter strip for the whole batch.
 *
 * Every counter — Expected / Existing / Selected / Extras, any tagged media
 * type, and the shortfall — shares a single divided row with its label and value
 * on the same baseline, and the per-service make-up of Expected sits underneath
 * on one line. This replaced two stacked full-width rows (label above value)
 * plus a separate warning banner, where the Expected tile also printed one line
 * per service. A routine two-service shoot spent 165px to show four numbers, and
 * a shoot with no tagged media still paid for an entire second row just to
 * render "Extras 0".
 *
 * Pinned to the top of the panel: these are the numbers the user checks while
 * working through the batch, so they stay put and the file list scrolls
 * underneath instead of carrying them off screen. `bg-card` matches the panel
 * this renders inside, so scrolled rows disappear behind it cleanly. The
 * negative top with matching top padding pins it slightly above the scroll edge
 * so the band of card padding above it is covered too — otherwise a sliver of
 * the list showed through there.
 */
export function RawUploadSummaryStrip({
  primaryStats,
  tagStats,
  expectedBreakdown,
}: {
  primaryStats: RawUploadStat[];
  tagStats: RawUploadStat[];
  expectedBreakdown: string;
}) {
  return (
    <div
      className="sticky -top-3 z-10 -mt-3 flex-shrink-0 space-y-1 bg-card pb-2 pt-3"
      data-testid="raw-upload-summary"
    >
      {/* Progress counters. auto-fit tracks rather than flex-wrap: a wrapping
          flex row grows each line independently, which produced ragged columns
          (125px on the first line, 187px on the second) and truncated the longer
          labels. auto-fit keeps every column the same width, and because it
          measures the container it stays correct inside the narrow dialog column
          where viewport breakpoints would misjudge the space. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] overflow-hidden rounded-md border bg-muted/50 text-xs">
        {primaryStats.map((stat) => (
          <div
            key={stat.key}
            className={`flex min-w-0 items-baseline justify-between gap-2 border-b border-r border-border/60 px-3 py-1.5 ${
              stat.alert ? 'bg-orange-500/10' : ''
            }`}
          >
            <span
              className={`truncate text-[11px] uppercase tracking-wide ${
                stat.alert ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground'
              }`}
              title={stat.label}
            >
              {stat.label}
            </span>
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${
                stat.alert ? 'text-orange-700 dark:text-orange-200' : 'text-foreground'
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Per-service tags on their own row, tinted to separate them from the
          progress block above. Emerald is already this codebase's colour for
          tagged media counts (see EditedUploadSection). */}
      {tagStats.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] overflow-hidden rounded-md border border-emerald-500/25 bg-emerald-500/[0.06] text-xs">
          {tagStats.map((stat) => (
            <div
              key={stat.key}
              className="flex min-w-0 items-baseline justify-between gap-2 border-b border-r border-emerald-500/20 px-3 py-1.5"
            >
              <span className="truncate text-emerald-700 dark:text-emerald-300" title={stat.label}>
                {stat.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {expectedBreakdown && (
        <p className="truncate px-1 text-[11px] leading-4 text-muted-foreground" title={expectedBreakdown}>
          {expectedBreakdown}
        </p>
      )}
    </div>
  );
}

/**
 * One service's staged files.
 *
 * Only the open group shows its file list; the rest collapse to a one-line
 * summary so a three-service batch stays readable. Collapsing is the whole point
 * of grouping: you fill a service, fold it away, and move to the next without
 * uploading in between.
 */
export function StagedGroupCard({
  group,
  isOpen,
  label,
  expectedCount,
  bracketMode,
  bracketOptions,
  onBracketChange,
  isPhotoService,
  serviceTargets,
  requiresServiceSelection,
  normalizedRole,
  onToggleOpen,
  onRemoveGroup,
  onChangeService,
  onToggleClassification,
  onRemoveFile,
}: {
  group: StagedUploadGroup;
  isOpen: boolean;
  label: string;
  /** Null when this service owes photos but no contracted count is configured. */
  expectedCount: number | null;
  /** Exposures per stack for this group's service, or null when it does not bracket. */
  bracketMode: number | null;
  bracketOptions: Array<{ value: number; expected: number | null }>;
  onBracketChange: (mode: number) => void;
  isPhotoService: boolean;
  serviceTargets: UploadServiceTarget[];
  requiresServiceSelection: boolean;
  normalizedRole: string;
  onToggleOpen: () => void;
  onRemoveGroup: () => void;
  onChangeService: (serviceId: string) => void;
  onToggleClassification: (file: File, index: number, mediaType: UploadQueueMediaType) => void;
  onRemoveFile: (index: number) => void;
}) {
  const brackets = bracketMode !== null;

  return (
    <div className="overflow-hidden rounded-md border bg-muted/20">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
        >
          {isOpen
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          {isPhotoService
            ? <Camera className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            : <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {group.files.length}
            {expectedCount > 0 ? ` / ${expectedCount}` : ''}
            {group.files.length === 1 ? ' file' : ' files'}
          </span>
          {brackets && (
            <span className="shrink-0 rounded bg-primary/10 px-1.5 text-[10px] uppercase tracking-wide text-primary">
              {bracketMode}x
            </span>
          )}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          title="Remove this service group"
          onClick={onRemoveGroup}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isOpen && (
        <div className="space-y-1 border-t bg-background/60 p-2">
          {/* Service and bracket share one row: the header above already states the
              service, count and size, so these controls exist only to change them and
              do not need a stacked block each. The service selector takes the flexible
              remaining width and the bracket control takes only what it needs. Wrapping
              is driven by the selector's own min-width rather than a viewport
              breakpoint, so the pair splits onto two lines exactly when the panel is
              genuinely too narrow — including inside a narrow modal on a wide screen. */}
          {(serviceTargets.length > 0 || brackets) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-1">
              {serviceTargets.length > 0 && (
                <div
                  className={`relative min-w-[11.5rem] flex-1 ${
                    // With no bracket control beside it, a full-width selector on a wide
                    // panel is just a very long dropdown for a short service name.
                    brackets ? 'basis-[60%]' : 'sm:max-w-xs'
                  }`}
                >
                  <select
                    value={group.serviceId}
                    onChange={(event) => onChangeService(event.target.value)}
                    className="h-8 w-full appearance-none truncate rounded-md border border-input bg-background pl-2.5 pr-8 text-xs font-medium text-foreground"
                    aria-label="Service for this upload group"
                  >
                    {/* A photographer with eligible booked services never sees an
                        unassigned option. Their whole job here is to file capture against
                        the service it was booked for, and offering "General / Unassigned"
                        made it possible to sidestep that with one click — the endpoint then
                        answers 422 anyway once more than one service is assigned. Admins keep
                        it as a deliberate escape hatch for legacy and reference uploads. */}
                    {normalizedRole !== 'photographer' && (
                      <option value="">General / Unassigned</option>
                    )}
                    {serviceTargets.map((target) => (
                      <option key={target.id} value={target.id}>{target.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                </div>
              )}

              {/* Bracket size belongs to this group, not to the shoot. Two services on
                  one shoot can be captured by different photographers at different
                  sizes, so a single shoot-wide picker could not express the batch. The
                  service arrives with its own size already resolved; this only changes
                  it for this upload. A service that does not bracket renders nothing
                  here rather than an empty half-row. */}
              {brackets && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Bracket
                  </span>
                  <div
                    role="radiogroup"
                    aria-label={`Bracket size for ${label}`}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-md border bg-muted/40 p-1"
                  >
                    {bracketOptions.map((option) => {
                      const isSelected = bracketMode === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          title={option.expected === null
                            ? `${option.value} exposures per final photo · expected count not set for ${label}`
                            : `${option.value} exposures per final photo · ${option.expected} raw files expected for ${label}`}
                          className={`flex items-baseline justify-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          onClick={() => onBracketChange(option.value)}
                        >
                          <span className="font-medium">{option.value}x</span>
                          <span
                            className={`tabular-nums ${
                              isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground/70'
                            }`}
                          >
                            {option.expected === null ? '—' : option.expected}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {group.files.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Drop files above to add them to this service.
            </p>
          ) : group.files.map((file, index) => (
            <div key={getQueueFileKey(file, index)} className="rounded-md p-2 transition-colors hover:bg-muted/40">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{file.name}</div>
                </div>
                {/* Extra only. Service ownership is the group's selector above, so
                    per-file service shortcuts belong nowhere on this row. */}
                <UploadClassificationButtons
                  file={file}
                  index={index}
                  classifications={group.classifications}
                  compact
                  options={RAW_STAGING_CLASSIFICATION_OPTIONS}
                  onToggle={onToggleClassification}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRemoveFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pinned footer. The editor note and the action bar are one unit: both belong to
 * the moment of committing the batch, so they stay on screen together while the
 * file list scrolls behind them. The note used to scroll away with the list, so
 * adding a note to a large batch meant scrolling back up past every file to find
 * the box. Opaque background because sticky content sits over the list.
 */
export function RawUploadCommitBar({
  notes,
  onNotesChange,
  stagedFileCount,
  stagedGroups,
  stagedServiceLabel,
  stagedServiceIsPhoto,
  expectedCount,
  totalRawCount,
  missingCount,
  isUploading,
  canUpload,
  onUpload,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
  stagedFileCount: number;
  stagedGroups: StagedUploadGroup[];
  stagedServiceLabel: string;
  stagedServiceIsPhoto: boolean;
  /** Null or 0 both mean "no honest denominator", so no progress bar is shown. */
  expectedCount: number | null;
  totalRawCount: number;
  missingCount: number;
  isUploading: boolean;
  canUpload: boolean;
  onUpload: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 flex-shrink-0 space-y-2 bg-card pt-2">
      <div className="space-y-1.5">
        <div className="text-sm font-medium text-foreground">Notes for Editor (Optional)</div>
        <Textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Add any notes for the editor..."
          className="min-h-[60px] max-h-[84px] resize-none"
        />
      </div>

      {/* Bottom action bar: what is being sent, where it is going, and the commit
          action, all on one line at the point of decision. The service picker
          used to sit at the very top of the panel, a full scroll away from the
          button that acts on it, and the bracket picker took a whole bordered row
          of its own. Both now live next to the action they qualify.
          Slots wrap on a minimum width rather than on viewport breakpoints: this
          panel renders inside a narrow dialog column, so the reflow has to follow
          the container's own width. Each slot keeps a floor of 190px and grows to
          share whatever is left, so a wide bar puts all three side by side and a
          narrow one stacks them full width — and the primary action never has to
          truncate its label to fit. */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
        <div className="flex min-w-[190px] flex-1 flex-col gap-1">
          {/* Service selection lives on each group card now, so this slot states
              what the one action will send. A picker here would have an ambiguous
              scope once several groups are staged. */}
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{stagedFileCount}</span>
            {stagedFileCount === 1 ? 'file' : 'files'}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </span>
          <span className="flex h-9 items-center gap-1.5 truncate text-sm font-medium text-foreground">
            {stagedGroups.length > 1 ? (
              <>
                <Camera className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{stagedGroups.length} services</span>
              </>
            ) : stagedGroups.length === 1 ? (
              <>
                {stagedServiceIsPhoto
                  ? <Camera className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  : <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="truncate" title={stagedServiceLabel}>{stagedServiceLabel}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Nothing staged</span>
            )}
          </span>
        </div>

        {/* Middle slot shows progress. The bracket picker used to live here as one
            shoot-wide control, which cannot express a batch where Exterior is 5x
            and Interior is 3x. Each group card now owns its own picker, next to the
            service it applies to. */}
        {expectedCount > 0 && (
          <div className="flex min-w-[190px] flex-1 flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Progress</span>
            <div className="flex h-9 flex-col justify-center gap-1">
              <Progress
                value={Math.min(100, Math.round((totalRawCount / expectedCount) * 100))}
                className="h-1.5"
              />
              <span className="truncate text-[11px] leading-none text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">
                  {totalRawCount} / {expectedCount}
                </span>
                {missingCount > 0 && (
                  <>
                    {' · '}
                    <span className="tabular-nums text-orange-700 dark:text-orange-300">
                      {missingCount} missing
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        )}

        <Button
          type="button"
          className="h-9 min-w-[190px] flex-1 shadow-sm"
          onClick={onUpload}
          disabled={isUploading || !canUpload}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="truncate">Uploading</span>
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">
                {stagedGroups.length > 1 ? `Upload all ${stagedFileCount} files` : 'Confirm & upload'}
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
