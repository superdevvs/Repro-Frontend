import { ChevronDown, Download, FileSpreadsheet, FileText, Files, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  EMPTY_INVOICE_CUSTOM_RANGE,
  INVOICE_DATE_PRESETS,
  type InvoiceDateFilter,
} from '@/utils/invoiceDateFilters';

export type InvoiceExportFormat = 'csv' | 'excel' | 'pdf';

export interface InvoiceDateFilterToolbarProps {
  filter: InvoiceDateFilter;
  onFilterChange: (filter: InvoiceDateFilter) => void;
  resultCount: number;
  selectedCount?: number;
  onClearSelection?: () => void;
  onExport: (format: InvoiceExportFormat) => void | Promise<void>;
  onBulkPdf?: () => void | Promise<void>;
  bulkPdfLabel?: string;
  disabled?: boolean;
  exportDisabled?: boolean;
  exporting?: boolean;
  resultNoun?: string;
  className?: string;
}

const countLabel = (count: number, noun: string) =>
  `${count.toLocaleString()} ${count === 1 ? noun : `${noun}s`}`;

export function InvoiceDateFilterToolbar({
  filter,
  onFilterChange,
  resultCount,
  selectedCount = 0,
  onClearSelection,
  onExport,
  onBulkPdf,
  bulkPdfLabel = 'Selected invoice PDFs',
  disabled = false,
  exportDisabled = false,
  exporting = false,
  resultNoun = 'invoice',
  className,
}: InvoiceDateFilterToolbarProps) {
  const exportUnavailable = disabled || exportDisabled || exporting || resultCount === 0;
  const pluralResultNoun = resultNoun.endsWith('s') ? resultNoun : `${resultNoun}s`;

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-2',
        'lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 overflow-x-auto">
          <div
            className="inline-flex min-w-max items-center gap-0.5 rounded-md bg-muted/70 p-0.5"
            role="group"
            aria-label={`Filter ${pluralResultNoun} by date`}
          >
            {INVOICE_DATE_PRESETS.map((preset) => {
              const active = filter.preset === preset.value;

              return (
                <button
                  key={preset.value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => onFilterChange({ ...filter, preset: preset.value })}
                  className={cn(
                    'h-8 rounded-[5px] px-2.5 text-xs font-medium text-muted-foreground transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    'disabled:pointer-events-none disabled:opacity-50 sm:px-3',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'hover:bg-background/60 hover:text-foreground',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {filter.preset === 'custom' ? (
          <div className="w-full animate-in fade-in slide-in-from-left-1 duration-200 sm:w-[15.5rem]">
            <DateRangePicker
              value={filter.customRange ?? EMPTY_INVOICE_CUSTOM_RANGE}
              onChange={(customRange) => onFilterChange({ preset: 'custom', customRange })}
              placeholder="Choose custom dates"
              disabled={disabled}
              align="start"
              triggerClassName="h-9 rounded-md bg-background px-3 text-xs"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span className="whitespace-nowrap font-medium">
            {countLabel(resultCount, resultNoun)}
          </span>
          {selectedCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2 pr-1 text-primary">
              <span className="whitespace-nowrap font-semibold">
                {selectedCount.toLocaleString()} selected
              </span>
              {onClearSelection ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClearSelection}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  aria-label={`Clear ${selectedCount.toLocaleString()} selected ${resultNoun}${selectedCount === 1 ? '' : 's'}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </span>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportUnavailable}
              className="h-9 gap-1.5 bg-background px-3"
              aria-label={exporting ? `Exporting ${pluralResultNoun}` : `Export ${pluralResultNoun}`}
            >
              <Download className="h-4 w-4" />
              <span>{exporting ? 'Exporting…' : 'Export'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {selectedCount > 0 ? `Export ${selectedCount.toLocaleString()} selected` : 'Export current results'}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void onExport('csv')}>
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              CSV spreadsheet
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onExport('excel')}>
              <FileSpreadsheet className="mr-2 h-4 w-4 text-muted-foreground" />
              Excel workbook
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onExport('pdf')}>
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              PDF report
            </DropdownMenuItem>

            {onBulkPdf ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={selectedCount === 0}
                  onSelect={() => void onBulkPdf()}
                >
                  <Files className="mr-2 h-4 w-4 text-muted-foreground" />
                  {bulkPdfLabel}
                  {selectedCount > 0 ? (
                    <span className="ml-auto text-xs text-muted-foreground">{selectedCount}</span>
                  ) : null}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
