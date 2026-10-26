import { LockKeyhole, Plus } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EmailWorkspaceDraft, EmailTemplateSection } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { EmailSectionContent } from './EmailSectionContent';
import { safeEditorHtml } from './emailWorkspaceModel';
import type { EmailArtworkStates } from './emailArtworkPreview';

interface Props {
  draft: EmailWorkspaceDraft; template: MessageTemplate | null; selected: string | null;
  disabled: boolean; onSelect: (id: string) => void; onAdd: () => void;
  artwork?: EmailArtworkStates;
  v2?: boolean; inline?: boolean;
  onSectionChange?: (id: string, patch: Partial<EmailTemplateSection>) => void;
  onReorder?: (id: string, beforeId: string) => void;
  onUpload?: (file: File, sectionId?: string) => void;
}

function SortableSection({ section, props, index }: { section: EmailTemplateSection; props: Props; index: number }) {
  const sortable = useSortable({ id: section.id, disabled: props.disabled || !props.v2 });
  function content(item: EmailTemplateSection, column?: number) {
    const selected = props.selected === item.id;
    return <div key={item.id} data-section-id={item.id} className="ews-editable-section" role="button" tabIndex={props.disabled ? -1 : 0} aria-disabled={props.disabled} data-selected={selected} aria-label={`Edit ${item.heading || item.type+' section '+(index+1)}`} onClick={event => { event.stopPropagation(); if (!props.disabled) props.onSelect(item.id); }} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter',' '].includes(event.key) && !props.disabled) { event.preventDefault(); props.onSelect(item.id); } }} onDragOver={event => event.preventDefault()} onDrop={event => { if (event.dataTransfer.files.length && props.onUpload) { event.preventDefault(); event.stopPropagation(); props.onUpload(event.dataTransfer.files[0], item.id); } }} style={{ textAlign: item.alignment, paddingBottom: item.spacing }}>
      <span className="ews-section-tag">{column !== undefined ? `Column ${column + 1} · ` : ''}{item.type} · click to edit</span>
      <EmailSectionContent section={column !== undefined && item.type === 'feature' ? { ...item, layout: 'stacked', image_width: Math.min(120, item.image_width ?? 120) } : item} artwork={props.artwork?.[item.media_id || item.artwork_id || '']} disabled={props.disabled} onChange={props.v2 && props.inline !== false && selected && props.onSectionChange ? patch => props.onSectionChange!(item.id, patch) : undefined}/>
    </div>;
  }
  return <div ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}>
    {props.v2 && <button className="ews-drag-handle" aria-label={`Reorder ${section.heading || section.type}`} disabled={props.disabled} {...sortable.attributes} {...sortable.listeners}>⠿ Move section</button>}
    {section.type === 'columns' ? <div className="ews-column-row" data-columns={section.columns?.length ?? 2} style={{ gridTemplateColumns: `repeat(${section.columns?.length ?? 2}, minmax(0,1fr))` }}><button className="ews-row-settings" disabled={props.disabled} onClick={() => props.onSelect(section.id)}>Edit column layout</button>{section.columns?.map((column, i) => <div key={i}>{column.map(item => content(item, i))}<button disabled={props.disabled || column.length >= 8} className="ews-column-add" onClick={() => props.onSectionChange?.(section.id, { columns: section.columns!.map((items, j) => i === j ? [...items, { id: crypto.randomUUID(), type: 'text', heading: '', body: '', image_url: '', alt: '', url: '', alignment: 'left', spacing: 16 }] : items) })}>+ Add text</button></div>)}</div> : content(section)}
  </div>;
}

export function EmailWorkspaceCanvas(props: Props) {
  const { draft, template, selected, disabled, onSelect, onAdd } = props;
  const sections = draft.editor_document_json.sections;
  const blocks = template?.editable_content_blocks ?? [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <>
    <article className="ews-paper" aria-label="Email canvas" onPaste={event => { const file = [...event.clipboardData.items].find(item => item.kind === 'file')?.getAsFile(); if (file && props.onUpload && !disabled) { event.preventDefault(); props.onUpload(file, selected ?? undefined); } }}>
      <header className="ews-content-heading"><strong>Email content</strong><span>Select a section to edit</span></header>
      <div className="ews-email-content">
        {draft.editor_document_json.format === 'sections' ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over && over.id !== active.id) props.onReorder?.(String(active.id), String(over.id)); }}><SortableContext items={sections.map(item => item.id)} strategy={verticalListSortingStrategy}>{sections.map((section, index) => <SortableSection key={section.id} section={section} props={props} index={index}/>)}</SortableContext></DndContext> : blocks.length ? <>
          <p className="ews-connected-note"><LockKeyhole size={14}/>Live details and conditional sections stay connected.</p>
          {blocks.map(block => <button key={block.key} disabled={disabled} className="ews-editable-section" data-selected={selected === block.key} onClick={() => onSelect(block.key)} aria-label={`Edit ${block.label}`}><span className="ews-section-tag">{block.label}</span><div className="ews-rich-copy" dangerouslySetInnerHTML={{ __html: safeEditorHtml(draft.content_blocks_json?.[block.key]?.body_html ?? block.body_html) }}/></button>)}
        </> : <button className="ews-editable-section" data-selected={selected === '__body'} disabled={disabled} onClick={() => onSelect('__body')} aria-label="Edit message content"><span className="ews-section-tag">Message · click to edit</span><div className="ews-rich-copy" dangerouslySetInnerHTML={{ __html: safeEditorHtml(draft.body_html ?? '') }}/></button>}
      </div>
    </article>
    {draft.editor_document_json.format === 'sections' && <button className="ews-add-section" disabled={disabled} onClick={onAdd}><Plus size={14}/>Add a section</button>}
    <p className="ews-canvas-note">Preview shows your email’s final design, branding, and sample data.</p>
  </>;
}
