import { Eye, EyeOff, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MediaFile } from '@/hooks/useShootFiles';
import { canManageMediaVisibility, canSetMediaHero } from './mediaPresentationPermissions';

export function MediaPresentationSelectionActions({ files, selectedFiles, role, onToggleHidden, onSetHero }: {
  files: MediaFile[];
  selectedFiles: Set<string>;
  role?: string;
  onToggleHidden?: (ids: string[], hidden: boolean) => void;
  onSetHero?: (id: string) => void;
}) {
  const selected = files.filter(file => selectedFiles.has(String(file.id)));
  if (!selected.length || selected.length !== selectedFiles.size) return null;
  const canManageAll = selected.every(file => canManageMediaVisibility(file, role));
  return <>
    {onToggleHidden && canManageAll && selected.some(file => !file.is_hidden) && (
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8" title="Hide selected" onClick={() => onToggleHidden(selected.map(file => file.id), true)}>
        <EyeOff /><span className="sr-only">Hide selected</span>
      </Button>
    )}
    {onToggleHidden && canManageAll && selected.some(file => file.is_hidden) && (
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8" title="Unhide selected" onClick={() => onToggleHidden(selected.map(file => file.id), false)}>
        <Eye /><span className="sr-only">Unhide selected</span>
      </Button>
    )}
    {onSetHero && selected.length === 1 && canSetMediaHero(selected[0], role) && (
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8" title="Set hero image" disabled={selected[0].is_cover} onClick={() => onSetHero(selected[0].id)}>
        <ImagePlus /><span className="sr-only">Set hero image</span>
      </Button>
    )}
  </>;
}
