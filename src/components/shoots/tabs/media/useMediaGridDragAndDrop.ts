import { useState, type DragEvent } from 'react';
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { MediaFile } from '@/hooks/useShootFiles';
import { normalizeManualOrder } from './mediaSort';

interface UseMediaGridDragAndDropOptions {
  enabled: boolean;
  visibleRegularIds: string[];
  regularFiles: MediaFile[];
  selectedFiles: Set<string>;
  onManualOrderChange?: (newOrder: string[]) => void;
}

export function useMediaGridDragAndDrop({
  enabled,
  visibleRegularIds,
  regularFiles,
  selectedFiles,
  onManualOrderChange,
}: UseMediaGridDragAndDropOptions) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const getDraggedBlock = (currentOrder: string[], activeId: string) => {
    const selectedBlock = currentOrder.filter((id) => selectedFiles.has(id));
    return selectedFiles.has(activeId) && selectedBlock.length > 1 ? selectedBlock : [activeId];
  };

  const handleDragStart = (event: DragEvent, fileId: string) => {
    if (!enabled) return;
    setDraggedId(fileId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', fileId);
  };

  const handleDragOver = (event: DragEvent, fileId: string) => {
    if (!enabled || !draggedId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (fileId !== draggedId) setDragOverId(fileId);
  };

  const handleDragLeave = () => setDragOverId(null);
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDrop = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    if (!enabled || !draggedId || draggedId === targetId) {
      handleDragEnd();
      return;
    }

    const currentOrder = normalizeManualOrder(visibleRegularIds, regularFiles);
    const draggedBlock = getDraggedBlock(currentOrder, draggedId);
    const sourceStartIndex = Math.min(
      ...draggedBlock.map((id) => currentOrder.indexOf(id)).filter((index) => index >= 0),
    );
    const targetIndex = currentOrder.indexOf(targetId);

    if (!draggedBlock.includes(targetId) && targetIndex !== -1 && sourceStartIndex !== Number.POSITIVE_INFINITY) {
      const remainingOrder = currentOrder.filter((id) => !draggedBlock.includes(id));
      const remainingTargetIndex = remainingOrder.indexOf(targetId);
      const insertIndex = sourceStartIndex < targetIndex ? remainingTargetIndex + 1 : remainingTargetIndex;
      remainingOrder.splice(insertIndex, 0, ...draggedBlock);
      onManualOrderChange?.(remainingOrder);
    }
    handleDragEnd();
  };

  const handleManualSortEnd = ({ active, over }: DragEndEvent) => {
    if (!enabled || !over || active.id === over.id) return;
    const currentOrder = normalizeManualOrder(visibleRegularIds, regularFiles);
    const activeId = String(active.id);
    const overId = String(over.id);
    const draggedBlock = getDraggedBlock(currentOrder, activeId);
    if (draggedBlock.includes(overId)) return;

    const sourceStartIndex = Math.min(
      ...draggedBlock.map((id) => currentOrder.indexOf(id)).filter((index) => index >= 0),
    );
    const targetIndex = currentOrder.indexOf(overId);
    if (sourceStartIndex === Number.POSITIVE_INFINITY || targetIndex === -1) return;

    if (draggedBlock.length === 1) {
      onManualOrderChange?.(arrayMove(currentOrder, currentOrder.indexOf(activeId), targetIndex));
      return;
    }
    const remainingOrder = currentOrder.filter((id) => !draggedBlock.includes(id));
    const remainingTargetIndex = remainingOrder.indexOf(overId);
    const insertIndex = sourceStartIndex < targetIndex ? remainingTargetIndex + 1 : remainingTargetIndex;
    remainingOrder.splice(insertIndex, 0, ...draggedBlock);
    onManualOrderChange?.(remainingOrder);
  };

  return {
    draggedId,
    dragOverId,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleManualSortEnd,
  };
}
