import { LockKeyhole, Plus } from 'lucide-react';
import type { EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { safeEditorHtml } from './emailWorkspaceModel';

interface Props {
  draft: EmailWorkspaceDraft; template: MessageTemplate | null; selected: string | null;
  disabled: boolean; onSelect: (id: string) => void; onAdd: () => void;
}

export function EmailWorkspaceCanvas({ draft, template, selected, disabled, onSelect, onAdd }: Props) {
  const sections = draft.editor_document_json.sections;
  const blocks = template?.editable_content_blocks ?? [];
  return <>
    <article className="ews-paper" aria-label="Email canvas">
      <header className="ews-email-brand"><img src="/images/repro-email-logo-light.png" alt="R/E Pro Photos"/><span>A NOTE FROM REPRO</span></header>
      <div className="ews-email-title">{draft.name === 'Untitled email' ? 'Your next great email.' : draft.name}</div>
      <div className="ews-email-content">
        {draft.editor_document_json.format === 'sections' ? sections.map((section, index) => <button key={section.id} className="ews-editable-section" data-selected={selected === section.id} disabled={disabled} onClick={() => onSelect(section.id)} aria-label={`Edit ${section.heading || section.type+' section '+(index+1)}`} style={{ textAlign: section.alignment, paddingBottom: section.spacing }}>
          <span className="ews-section-tag">{section.type} · click to edit</span>
          {section.type === 'image' ? /^https?:\/\//i.test(section.image_url) ? <img className="ews-section-image" src={section.image_url} alt={section.alt} referrerPolicy="no-referrer"/> : <div className="ews-image-placeholder">Add an image or generate one with Robbie</div>
            : section.type === 'divider' ? <hr/>
            : section.type === 'button' ? <span className="ews-email-button">{section.heading || 'Button label'}</span>
            : <div className={section.type === 'notice' ? 'ews-notice' : ''}>{section.heading && <h2>{section.heading}</h2>}{section.type === 'tips' ? <ul>{section.body.split('\n').filter(Boolean).map((tip, i) => <li key={i}>{tip}</li>)}</ul> : <p>{section.body || (!section.heading ? 'Click to write your message…' : '')}</p>}</div>}
        </button>) : blocks.length ? <>
          <p className="ews-connected-note"><LockKeyhole size={14}/>Live details and conditional sections stay connected.</p>
          {blocks.map(block => <button key={block.key} disabled={disabled} className="ews-editable-section" data-selected={selected === block.key} onClick={() => onSelect(block.key)} aria-label={`Edit ${block.label}`}><span className="ews-section-tag">{block.label}</span><div className="ews-rich-copy" dangerouslySetInnerHTML={{ __html: safeEditorHtml(draft.content_blocks_json?.[block.key]?.body_html ?? block.body_html) }}/></button>)}
        </> : <button className="ews-editable-section" data-selected={selected === '__body'} disabled={disabled} onClick={() => onSelect('__body')} aria-label="Edit message content"><span className="ews-section-tag">Message · click to edit</span><div className="ews-rich-copy" dangerouslySetInnerHTML={{ __html: safeEditorHtml(draft.body_html ?? '') }}/></button>}
      </div>
      <footer>R/E Pro Photos <span>Thoughtfully captured. Beautifully delivered.</span></footer>
    </article>
    {draft.editor_document_json.format === 'sections' && <button className="ews-add-section" disabled={disabled} onClick={onAdd}><Plus size={14}/>Add a section</button>}
    <p className="ews-canvas-note">Select a section to edit it. Preview shows the email with its final layout and sample data.</p>
  </>;
}
