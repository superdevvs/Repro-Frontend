import { useState, type ReactNode } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { EditorShell, MediaFilmstrip } from '@/components/ai-editing/v4/EditorShell';
import { PhotoComparison } from '@/components/ai-editing/v4/PhotoComparison';

type PhotoView = 'compare' | 'before' | 'after';
export function StudioPhotoCanvas({ title, subtitle, name, original = '', result = '', working = false, progress = null, versionNumber = 1, onBack, onChangeSource, actions, inspector, error, status, onRefresh }: {
  title: string; subtitle: string; name: string; original?: string; result?: string; working?: boolean; progress?: number | null;
  onBack: () => void; onChangeSource?: () => void; actions: ReactNode; inspector: ReactNode; error?: string; status?: string; onRefresh?: () => void; versionNumber?: number;
}) {
  const [view, setView] = useState<PhotoView>('compare'); const [position, setPosition] = useState(50);
  const selected = result ? original ? view : 'after' : 'before';
  const controls = <div className="absolute left-3 top-3 z-30 inline-flex gap-1 rounded-xl border border-white/10 bg-background/95 p-1" role="group" aria-label="Photo view">{(['compare', 'before', 'after'] as const).map(value => <button key={value} type="button" aria-pressed={selected === value} disabled={value === 'compare' ? !original || !result : value === 'after' ? !result : !original} onClick={() => setView(value)} className={`rounded-lg px-3 py-2 text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${selected === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{value === 'compare' ? 'Compare' : value === 'before' ? 'Before' : 'After'}</button>)}</div>;
  return <div className="studio-client-canvas flex min-h-0 flex-1 flex-col"><EditorShell title={title} subtitle={subtitle} shootLabel={name} onBack={onBack} backLabel="Back to Listing Studio" onChangeSource={onChangeSource} actions={actions} inspector={inspector} error={error} status={status} filmstrip={<MediaFilmstrip label="Your photo" items={original || result ? [{ id: 'current', url: result || original, name }] : []} selectedId="current" onSelect={() => undefined} />}>
    {original || result ? <div className="v4-photo-focus"><PhotoComparison name={name} originalUrl={original || result} editedUrl={selected === 'before' ? undefined : result || undefined} generating={working} comparing={selected === 'compare' && Boolean(original && result)} position={position} onPositionChange={setPosition} progress={progress} generationLabel={title} onRefresh={onRefresh} version={versionNumber} overlay={controls} /></div> : <div role="status" className="flex h-full min-h-52 flex-col items-center justify-center gap-3 text-muted-foreground">{error ? <ImageIcon className="h-7 w-7" /> : <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />}<p className="text-sm">{error ? 'Preview unavailable' : 'Loading your photo…'}</p></div>}
  </EditorShell></div>;
}
