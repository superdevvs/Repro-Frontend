import { Check, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getAvatarUrl } from '@/utils/defaultAvatars';

type Props = {
  photographer?: { id: string; name: string; avatar?: string | null } | null;
  canConfirm: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A full-width action row, separate from the independently scrolling map/list. */
export function PhotographerSelectionFooter({ photographer, canConfirm, onConfirm, onCancel }: Props) {
  return (
    <div data-testid="photographer-selection-footer" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 px-1 pt-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0 border border-border">
          {photographer && <AvatarImage src={getAvatarUrl(photographer.avatar, 'photographer', undefined, photographer.id)} alt="" />}
          <AvatarFallback>{photographer?.name?.charAt(0) || <User className="h-4 w-4" />}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{photographer ? 'Selected photographer' : 'Your photographer'}</p>
          <p className="truncate text-sm font-semibold">{photographer?.name || 'Choose someone from the list or map'}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" className="rounded-xl" onClick={onCancel}>Discard</Button>
        <Button type="button" className="h-10 gap-2 rounded-xl px-5" disabled={!canConfirm} onClick={onConfirm}>
          <Check className="h-4 w-4" /> Confirm Assignment
        </Button>
      </div>
    </div>
  );
}
