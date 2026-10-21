import { ArrowUpDown, Check, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MediaSortOrder } from './mediaSort';

const sortOptions: Array<{ value: MediaSortOrder; label: string; shortLabel: string }> = [
  { value: 'manual', label: 'Manual (Drag & Drop)', shortLabel: 'Manual' },
  { value: 'time', label: 'Time Captured', shortLabel: 'Time' },
  { value: 'name', label: 'File Name', shortLabel: 'Name' },
  { value: 'date', label: 'Date Added', shortLabel: 'Date' },
];

export function MediaSortControl({
  open, onOpenChange, sortOrder, isDragMode, sortSaveStatus, changeSortOrder, toggleDragMode, compact = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sortOrder: MediaSortOrder;
  isDragMode: boolean;
  sortSaveStatus: 'idle' | 'saving' | 'saved';
  changeSortOrder: (order: MediaSortOrder) => void;
  toggleDragMode: () => void;
  compact?: boolean;
}) {
  const label = sortOptions.find(option => option.value === sortOrder)?.shortLabel;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {sortOrder === 'manual' && (
        <Button
          variant={isDragMode ? 'default' : 'outline'}
          size="icon"
          className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8"
          onClick={toggleDragMode}
          aria-label={isDragMode ? 'Stop reordering media' : 'Start reordering media'}
          aria-pressed={isDragMode}
          title={isDragMode ? 'Done reordering — keep this order' : 'Drag to reorder media'}
        >
          {isDragMode ? <Check /> : <GripVertical />}
        </Button>
      )}
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 shrink-0 text-xs sm:h-8 ${compact ? 'w-9 gap-0 px-0 sm:w-auto sm:gap-1.5 sm:px-2' : 'gap-1.5 px-2'}`}
            aria-label="Choose media sort order"
            title={`Sort: ${label}`}
          >
            {sortSaveStatus === 'saving' ? <InlineSpinner aria-hidden="true" /> : <ArrowUpDown />}
            <span className={compact ? 'hidden sm:inline' : undefined}>Sort<span className="hidden lg:inline">: {label}</span></span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={12}>
          <DropdownMenuLabel>Sort media</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sortOrder} onValueChange={value => changeSortOrder(value as MediaSortOrder)}>
            {sortOptions.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value} className="min-h-10">
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="sr-only" role="status">
        {sortSaveStatus === 'saving' ? 'Saving media order' : sortSaveStatus === 'saved' ? 'Media order saved' : ''}
      </span>
    </div>
  );
}
