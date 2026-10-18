import { LockKeyhole, Plus } from 'lucide-react';
import type { EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { EmailSectionContent } from './EmailSectionContent';
import { safeEditorHtml } from './emailWorkspaceModel';
import type { EmailArtworkStates } from './emailArtworkPreview';

interface Props {
  draft: EmailWorkspaceDraft; template: MessageTemplate | null; selected: string | null;
  disabled: boolean; onSelect: (id: string) => void; onAdd: () => void;
  artwork?: EmailArtworkStates;
}

export function EmailWorkspaceCanvas({ draft, template, selected, disabled, onSelect, onAdd, artwork }: Props) {
  const sections = draft.editor_document_json.sections;
  const blocks = template?.editable_content_blocks ?? [];
  return <>
    <article className="ews-paper" aria-label="Email canvas">
      <header className="ews-content-heading"><strong>Email content</strong><span>Select a section to edit</span></header>
      <div className="ews-email-content">
        {draft.editor_document_json.format === 'sections' ? sections.map((section, index) => <button key={section.id} className="ews-editable-section" data-selected={selected === section.id} disabled={disabled} onClick={() => onSelect(section.id)} aria-label={`Edit ${section.heading || section.type+' section '+(index+1)}`} style={{ textAlign: section.alignment, paddingBottom: section.spacing }}>
          <span className="ews-section-tag">{section.type} · click to edit</span>
          <EmailSectionContent section={section} artwork={section.artwork_id ? artwork?.[section.artwork_id] : undefined}/>
        </button>) : blocks.length ? <>
          <p className="ews-connected-note"><LockKeyhole size={14}/>Live details and conditional sections stay connected.</p>
          {blocks.map(block => <button key={block.key} disabled={disabled} className="ews-editable-section" data-selected={selected === block.key} onClick={() => onSelect(block.key)} aria-label={`Edit ${block.label}`}><span className="ews-section-tag">{block.label}</span><div className="ews-rich-copy" dangerouslySetInnerHTML={{ __html: safeEditorHtml(draft.content_blocks_json?.[block.key]?.body_html ?? block.body_html) }}/></button>)}
        </> : <button className="ews-editable-section" data-selected={selected === '__body'} disabled={disabled} onClick={() => onSelect('__body')} aria-label="Edit message content"><span className="ews-section-tag">Message · click to edit</span><div className="ews-rich-copy" dangerouslySetInnerHTML={{ __html: safeEditorHtml(draft.body_html ?? '') }}/></button>}
      </div>
    </article>
    {draft.editor_document_json.format === 'sections' && <button className="ews-add-section" disabled={disabled} onClick={onAdd}><Plus size={14}/>Add a section</button>}
    <p className="ews-canvas-note">Preview shows your email’s final design, branding, and sample data.</p>
  </>;
}
