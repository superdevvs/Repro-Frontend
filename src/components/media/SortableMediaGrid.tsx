import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CSSProperties } from 'react';
import { CachedImage } from './ImageCache';
import { FileIcon, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { RawImagePreview } from './RawImagePreview';
import { isRawFile } from '@/services/rawPreviewService';

interface MediaFile {
  id: string;
  filename: string;
  url?: string;
  path?: string;
  fileType?: string;
  workflowStage?: string;
  isExtra?: boolean;
  thumb?: string;
  medium?: string;
  large?: string;
  original?: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

interface SortableMediaGridProps {
  files: MediaFile[];
  onFileClick: (index: number) => void;
  selectedFiles: Set<string>;
  onSelectionChange: (fileId: string) => void;
  canSelect: boolean;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  isImage: (file: MediaFile) => boolean;
  onReorder?: (oldIndex: number, newIndex: number) => void | Promise<void>;
  isDragEnabled?: boolean;
}

function SortableItem({ 
  file, 
  index, 
  isSelected, 
  isImg, 
  canSelect, 
  getImageUrl, 
  onFileClick, 
  onSelectionChange 
}: {
  file: MediaFile;
  index: number;
  isSelected: boolean;
  isImg: boolean;
  canSelect: boolean;
  getImageUrl: (file: MediaFile, size?: 'thumb' | 'medium' | 'large' | 'original') => string;
  onFileClick: (index: number) => void;
  onSelectionChange: (fileId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const ext = file.filename.split('.').pop()?.toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative aspect-square rounded overflow-hidden border cursor-pointer transition-all group ${
        isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50'
      }`}
      onClick={() => {
        if (canSelect) {
          onSelectionChange(file.id);
        } else {
          onFileClick(index);
        }
      }}
      onDoubleClick={() => onFileClick(index)}
    >
      {isImg ? (
        <CachedImage
          src={getImageUrl(file, 'thumb')}
          alt={file.filename}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : isRawFile(file.filename) ? (
        <RawImagePreview
          src={getImageUrl(file, 'thumb')}
          filename={file.filename}
          filePath={file.path || file.url}
          containerClassName="w-full h-full"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <FileIcon className="h-6 w-6" />
            {ext && <span className="text-[10px] font-semibold">{ext}</span>}
          </div>
        </div>
      )}
      
      {/* Drag handle - visible on hover */}
      <div 
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded p-1 cursor-move"
      >
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
        </svg>
      </div>
      
      {isSelected && (
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
          <CheckCircle2 className="h-3 w-3" />
        </div>
      )}
      
      {canSelect && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelectionChange(file.id)}
            className="bg-background/80"
          />
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {file.filename}
      </div>
    </div>
  );
}

export function SortableMediaGrid({ 
  files, 
  onFileClick, 
  selectedFiles, 
  onSelectionChange, 
  canSelect,
  getImageUrl,
  isImage,
  onReorder,
  isDragEnabled = false
}: SortableMediaGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = files.findIndex((file) => file.id === active.id);
      const newIndex = files.findIndex((file) => file.id === over?.id);

      if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
        onReorder(oldIndex, newIndex);
      }
    }

    setActiveId(null);
  }

  const activeFile = files.find((file) => file.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={files.map(f => f.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-1">
          {files.map((file, index) => {
            const isSelected = selectedFiles.has(file.id);
            const isImg = isImage(file);
            
            return (
              <SortableItem
                key={file.id}
                file={file}
                index={index}
                isSelected={isSelected}
                isImg={isImg}
                canSelect={canSelect && !isDragEnabled}
                getImageUrl={getImageUrl}
                onFileClick={onFileClick}
                onSelectionChange={onSelectionChange}
              />
            );
          })}
        </div>
      </SortableContext>
      
      <DragOverlay>
        {activeFile && activeId ? (
          <div className="relative aspect-square rounded overflow-hidden border-2 border-primary shadow-2xl opacity-90">
            {isImage(activeFile) ? (
              <CachedImage
                src={getImageUrl(activeFile, 'thumb')}
                alt={activeFile.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <FileIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
              {activeFile.filename}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
