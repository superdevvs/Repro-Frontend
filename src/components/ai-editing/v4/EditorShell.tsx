import { StudioImage } from '@/components/studio/v4/StudioImage';
import type { ReactNode } from 'react';
import { ArrowLeft, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import './workspace.css';

interface EditorShellProps {
  title: string;
  subtitle: string;
  shootLabel: string;
  onBack: () => void;
  onChangeSource?: () => void;
  modeControl?: ReactNode;
  actions: ReactNode;
  inspector: ReactNode;
  filmstrip: ReactNode;
  children: ReactNode;
  error?: string | null;
  status?: string;
}

/** The existing dashboard owns global navigation; this is the single local editor tier. */
export function EditorShell({ title, subtitle, shootLabel, onBack, onChangeSource, modeControl, actions, inspector, filmstrip, children, error, status }: EditorShellProps) {
  return (
    <section className="v4-editor" aria-label={`${title} workspace`}>
      <header className="v4-editor-toolbar">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to AI editing"><ArrowLeft /></Button>
        {onChangeSource ? <Button variant="outline" className="v4-editor-source" onClick={onChangeSource}><span>{shootLabel}</span><ChevronDown /></Button> : <span className="v4-editor-source-label">{shootLabel}</span>}
        <div className="v4-editor-heading"><h1>{title}</h1><p>{subtitle}</p></div>
        <div className="v4-editor-mode">{modeControl}</div>
        <span className="v4-editor-status" aria-live="polite">{status}</span>
        <div className="v4-editor-desktop-actions">{actions}</div>
        <Dialog>
          <DialogTrigger asChild><Button variant="outline" size="icon" className="v4-editor-inspector-trigger" aria-label="Edit settings"><SlidersHorizontal /></Button></DialogTrigger>
          <DialogContent className="v4-editor-dialog v4-editor-settings-dialog">
            <DialogTitle>Edit settings</DialogTitle><DialogDescription>{subtitle}</DialogDescription>
            <div className="v4-editor-settings-content">{inspector}</div>
          </DialogContent>
        </Dialog>
      </header>
      {error && <div className="v4-editor-error" role="alert">{error}</div>}
      <div className="v4-editor-body">
        <main className="v4-editor-stage">{children}</main>
        <aside className="v4-editor-inspector" aria-label="Edit settings">{inspector}</aside>
        <div className="v4-editor-filmstrip">{filmstrip}</div>
      </div>
      <footer className="v4-editor-mobile-actions">{actions}</footer>
    </section>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="v4-inspector-section"><h2>{title}</h2>{children}</section>;
}

export function InspectorFact({ label, value }: { label: string; value: ReactNode }) {
  return <div className="v4-inspector-fact"><span>{label}</span><strong>{value}</strong></div>;
}

export interface FilmstripItem { id: string; url: string; name: string; detail?: string; status?: string }

export function MediaFilmstrip({ items, selectedId, onSelect, label = 'Shoot images' }: { items: FilmstripItem[]; selectedId: string | null; onSelect: (id: string) => void; label?: string }) {
  return <div className="v4-filmstrip-content"><div className="v4-filmstrip-caption"><span>{label}</span><span>{items.length} {items.length === 1 ? 'item' : 'items'}</span></div><div className="v4-filmstrip-items" role="group" aria-label={label}>{items.map((item, index) => <button key={item.id} type="button" className="v4-filmstrip-item" aria-pressed={selectedId === item.id} aria-label={`Select ${item.name}`} onClick={() => onSelect(item.id)}><div><StudioImage src={item.url} alt="" loading="lazy" /><span className="v4-filmstrip-number">{String(index + 1).padStart(2, '0')}</span>{item.status && <span className="v4-filmstrip-state">{item.status}</span>}</div><span className="v4-filmstrip-label"><span>{item.name}</span><small>{item.detail}</small></span></button>)}</div></div>;
}
