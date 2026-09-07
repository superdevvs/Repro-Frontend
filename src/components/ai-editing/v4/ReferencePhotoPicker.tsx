import { Check } from 'lucide-react';
import { StudioImage } from '@/components/studio/v4/StudioImage';
import type { V4Media } from '@/components/studio/v4/types';

export function ReferencePhotoPicker({ media, selected, onChange, disabled }: {
  media: V4Media[]; selected: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  return <details className="rounded-lg border p-3">
    <summary className="cursor-pointer text-sm font-medium">Reference photos · {selected.length} of 4</summary>
    <p className="mb-3 mt-2 text-xs text-muted-foreground">Choose photos already in this workspace to guide the edit. Describe what to match in your note.</p>
    {media.length ? <div className="grid auto-cols-[96px] grid-flow-col grid-rows-1 gap-2 overflow-x-auto pb-1">{media.map(item => <button key={item.id} type="button" aria-pressed={selected.includes(item.id)} disabled={disabled || (!selected.includes(item.id) && selected.length >= 4)} onClick={() => toggle(item.id)} className="overflow-hidden rounded-lg border text-left disabled:opacity-50" aria-label={`Reference ${item.name}`}><div className="relative aspect-[1.4]"><StudioImage src={item.thumbnailUrl || item.url} alt="" className="h-full w-full object-cover" />{selected.includes(item.id) && <span className="absolute right-1 top-1 rounded-full bg-primary p-1 text-primary-foreground"><Check size={12} /></span>}</div><span className="block truncate px-2 py-1.5 text-[11px]">{item.name}</span></button>)}</div> : <p className="text-xs text-muted-foreground">Add other photos to this workspace to use them as references.</p>}
  </details>;
}
