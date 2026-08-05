import type React from 'react';
import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { MediaStack } from './mediaGridStacks';

interface MediaGridLayoutProps {
  viewMode: 'list' | 'grid';
  canSelect: boolean;
  isClient: boolean;
  files: MediaFile[];
  selectedFiles: Set<string>;
  onSelectAll?: () => void;
  showMultiSortHint: boolean;
  isManualSortEnabled: boolean;
  sensors: React.ComponentProps<typeof DndContext>['sensors'];
  onManualSortEnd: (event: DragEndEvent) => void;
  visibleRegularIds: string[];
  regularFiles: MediaFile[];
  regularStacks: MediaStack[];
  extraFiles: MediaFile[];
  renderFileCard: (file: MediaFile, index: number, isExtra?: boolean) => React.ReactNode;
  renderStackCard: (stack: MediaStack, index: number) => React.ReactNode;
  renderSortableFileCard: (file: MediaFile, index: number) => React.ReactNode;
  renderFileRow: (file: MediaFile, index: number, isExtra?: boolean) => React.ReactNode;
  renderSortableFileRow: (file: MediaFile, index: number) => React.ReactNode;
}

function SelectAllControl({ files, selectedFiles, onSelectAll }: Pick<MediaGridLayoutProps, 'files' | 'selectedFiles' | 'onSelectAll'>) {
  const allSelected = selectedFiles.size === files.length;
  return (
    <div className="cursor-pointer hover:text-foreground transition-colors text-muted-foreground" onClick={onSelectAll} title={allSelected ? 'Deselect All' : 'Select All'}>
      {allSelected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : selectedFiles.size > 0 ? <MinusCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
    </div>
  );
}

export function MediaGridLayout(props: MediaGridLayoutProps) {
  const {
    viewMode, canSelect, isClient, files, selectedFiles, onSelectAll, showMultiSortHint,
    isManualSortEnabled, sensors, onManualSortEnd, visibleRegularIds, regularFiles,
    regularStacks, extraFiles, renderFileCard, renderStackCard, renderSortableFileCard,
    renderFileRow, renderSortableFileRow,
  } = props;

  if (viewMode === 'grid') {
    return (
      <div className="space-y-2">
        {canSelect && files.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-1">
            <SelectAllControl files={files} selectedFiles={selectedFiles} onSelectAll={onSelectAll} />
            <span className="text-[10px] text-muted-foreground">{selectedFiles.size > 0 ? `${selectedFiles.size} selected` : 'Select all'}</span>
          </div>
        )}
        {showMultiSortHint && <div className="px-1 text-[11px] text-muted-foreground">Select multiple images, then drag one to move the group.</div>}
        {isManualSortEnabled ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onManualSortEnd}>
            <SortableContext items={visibleRegularIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                {regularFiles.map(renderSortableFileCard)}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">{regularStacks.map(renderStackCard)}</div>
        )}
        {extraFiles.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-orange-500/30" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 px-2">Extras ({extraFiles.length})</span>
              <div className="flex-1 h-px bg-orange-500/30" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">{extraFiles.map((file, index) => renderFileCard(file, index, true))}</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="hidden sm:flex items-center gap-3 px-2 py-1 text-[10px] text-muted-foreground font-medium border-b">
        {canSelect && <div className="w-4 flex-shrink-0"><SelectAllControl files={files} selectedFiles={selectedFiles} onSelectAll={onSelectAll} /></div>}
        <div className="w-28 flex-shrink-0">Preview</div>
        <div className="flex-1">Filename</div>
        {!isClient && <><div className="w-36 flex-shrink-0" aria-hidden="true" /><div className="w-20 flex-shrink-0" aria-hidden="true" /></>}
        <div className="w-6 flex-shrink-0" />
      </div>
      {showMultiSortHint && <div className="px-2 text-[11px] text-muted-foreground">Select multiple images, then drag one to move the group.</div>}
      {isManualSortEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onManualSortEnd}>
          <SortableContext items={visibleRegularIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">{regularFiles.map(renderSortableFileRow)}</div>
          </SortableContext>
        </DndContext>
      ) : <div className="space-y-1">{regularFiles.map((file, index) => renderFileRow(file, index, false))}</div>}
      {extraFiles.length > 0 && (
        <>
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-orange-500/30" />
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 px-2">Extras ({extraFiles.length})</span>
            <div className="flex-1 h-px bg-orange-500/30" />
          </div>
          <div className="space-y-1">{extraFiles.map((file, index) => renderFileRow(file, index, true))}</div>
        </>
      )}
    </div>
  );
}
