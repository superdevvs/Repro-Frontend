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
      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onToggleHidden(selected.map(file => file.id), true)}>
        <EyeOff className="mr-1 h-3.5 w-3.5" />Hide selected
      </Button>
    )}
    {onToggleHidden && canManageAll && selected.some(file => file.is_hidden) && (
      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onToggleHidden(selected.map(file => file.id), false)}>
        <Eye className="mr-1 h-3.5 w-3.5" />Unhide selected
      </Button>
    )}
    {onSetHero && selected.length === 1 && canSetMediaHero(selected[0], role) && (
      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" disabled={selected[0].is_cover} onClick={() => onSetHero(selected[0].id)}>
        <ImagePlus className="mr-1 h-3.5 w-3.5" />Set hero image
      </Button>
    )}
  </>;
}
