import { Check, Layers } from 'lucide-react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import { StudioImage } from './StudioImage';
import type { PickerTile } from './usePickerSources';
import type { V4Media } from './types';

export function PickerPhotoCard({ tile, selected, onSelect, onRetry }: { tile: PickerTile & { error?: string }; selected: boolean; onSelect: (media: V4Media) => void; onRetry: () => void }) {
  const stacked = tile.sources.length > 1;
  const name = tile.media?.name || tile.sources[0].filename;
  return <article className="min-w-0">
    <button disabled={!tile.media} onClick={() => tile.media && onSelect(tile.media)} aria-label={`Select ${name}`} aria-pressed={selected} className="group block w-full min-w-0 text-left disabled:cursor-wait">
      <div className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 bg-muted/30 ${selected ? 'border-primary' : 'border-transparent'}`}>
        {tile.media ? <StudioImage src={tile.media.thumbnailUrl} alt={name} className="h-full w-full object-contain" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><Layers size={28} /><span className="flex items-center gap-2 text-xs">{tile.error ? 'Merge unavailable' : <><InlineSpinner size={14} />Preparing merged HDR…</>}</span></div>}
        <span className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border ${selected ? 'border-primary bg-primary text-white' : 'border-white/60 bg-black/40'}`}>{selected && <Check size={14} />}</span>
        {stacked && <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[10px] text-white"><Layers size={12} />{tile.sources.length} exposures · {tile.media ? 'Merged HDR' : 'HDR stack'}</span>}
      </div>
      <p className="mt-2 truncate text-xs">{name}</p>
    </button>
    {stacked && <div className="mt-2 flex gap-1" aria-label="Bracket exposures">{tile.sources.map(source => <StudioImage key={source.id} src={source.thumbnailUrl} alt={source.filename} className="h-9 min-w-0 flex-1 rounded object-cover" />)}</div>}
    {tile.error && <div className="mt-2 text-xs text-destructive"><p role="alert">{tile.error}</p><Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>Retry merge</Button></div>}
  </article>;
}
