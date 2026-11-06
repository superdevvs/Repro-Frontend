import { Eye, EyeOff, ImagePlus, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { getMediaPresentationSelectionState, type MediaPresentationSelectionOptions } from './mediaPresentationSelectionState';

export function MediaPresentationSelectionActions({ files, selectedFiles, role, onToggleHidden, onSetHero, variant = 'buttons' }: MediaPresentationSelectionOptions & {
  variant?: 'buttons' | 'menu';
}) {
  const { selected, canHide, canUnhide, canSetHero } = getMediaPresentationSelectionState({ files, selectedFiles, role, onToggleHidden, onSetHero });
  if (!selected.length) return null;
  const renderAction = (label: string, Icon: LucideIcon, onActivate: () => void, disabled = false) => variant === 'menu' ? (
    <DropdownMenuItem disabled={disabled} onSelect={onActivate}>
      <Icon className="mr-2 h-4 w-4" aria-hidden="true" />{label}
    </DropdownMenuItem>
  ) : (
    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 gap-0 sm:h-8 sm:w-8" title={label} disabled={disabled} onClick={onActivate}>
      <Icon /><span className="sr-only">{label}</span>
    </Button>
  );
  return <>
    {onToggleHidden && canHide && renderAction('Hide selected', EyeOff, () => onToggleHidden(selected.map(file => file.id), true))}
    {onToggleHidden && canUnhide && renderAction('Unhide selected', Eye, () => onToggleHidden(selected.map(file => file.id), false))}
    {onSetHero && canSetHero && renderAction('Set hero image', ImagePlus, () => onSetHero(selected[0].id), selected[0].is_cover)}
  </>;
}
