import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EmailTemplateSection, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { plainText } from './emailWorkspaceModel';

interface Props {
  selected: string; draft: EmailWorkspaceDraft; template: MessageTemplate | null; disabled: boolean;
  onChange: (next: EmailWorkspaceDraft, label: string) => void;
  onSectionAction: (action: 'up' | 'down' | 'duplicate' | 'delete') => void;
  onClose: () => void; onAsk: () => void; onArtwork: () => void; onPersonalize: () => void;
}

export function EmailWorkspaceInspector({ selected, draft, template, disabled, onChange, onSectionAction, onClose, onAsk, onArtwork, onPersonalize }: Props) {
  const [format, setFormat] = useState<'text' | 'html'>('text');
  const section = draft.editor_document_json.sections.find(item => item.id === selected);
  const block = template?.editable_content_blocks?.find(item => item.key === selected);
  const blockHtml = block ? draft.content_blocks_json?.[block.key]?.body_html ?? block.body_html : draft.body_html ?? '';

  function updateSection(patch: Partial<EmailTemplateSection>) {
    onChange({ ...draft, editor_document_json: { ...draft.editor_document_json,
      sections: draft.editor_document_json.sections.map(item => item.id === selected ? { ...item, ...patch } : item) } }, 'Edit section');
  }
  function updateHtml(value: string) {
    const html = format === 'html' ? value : '<p>'+value.split('\n').map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>')+'</p>';
    const text = format === 'html' ? plainText(value) : value;
    if (block) onChange({ ...draft, content_blocks_json: { ...draft.content_blocks_json, [block.key]: { body_html: html, body_text: text } } }, 'Edit '+block.label);
    else onChange({ ...draft, body_html: html, body_text: text }, 'Edit message');
  }

  return <aside className="ews-inspector" aria-label="Section editor">
    <div className="ews-inspector-heading"><div><span>EDIT SECTION</span><h3>{block?.label ?? (section?.type === 'image' ? 'Image' : 'Your content')}</h3></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close section editor"><X size={16}/></Button></div>
    <fieldset disabled={disabled} className="ews-inspector-fields">
      {section ? <>
        {!['image', 'divider'].includes(section.type) && <label>Heading<Input value={section.heading} onChange={event => updateSection({ heading: event.target.value })}/></label>}
        {['text', 'tips', 'notice'].includes(section.type) && <label>{section.type === 'tips' ? 'Tips · one per line' : 'Message'}<Textarea rows={8} value={section.body} onChange={event => updateSection({ body: event.target.value })}/></label>}
        {section.type === 'image' && <><label>Image URL<Input type="url" value={section.image_url} onChange={event => updateSection({ image_url: event.target.value })}/></label><label>Image description<Input value={section.alt} onChange={event => updateSection({ alt: event.target.value })}/></label><Button variant="outline" onClick={onArtwork}>Generate matching artwork</Button><p className="ews-help">Leave the description empty for a decorative image.</p></>}
        {section.type === 'button' && <label>Button link<Input value={section.url} placeholder="https://… or {{portal_url}}" onChange={event => updateSection({ url: event.target.value })}/></label>}
        <label>Alignment<select value={section.alignment} onChange={event => updateSection({ alignment: event.target.value as EmailTemplateSection['alignment'] })}><option>left</option><option>center</option><option>right</option></select></label>
        <label>Space below<select value={section.spacing} onChange={event => updateSection({ spacing: Number(event.target.value) })}>{[8, 16, 24, 32, 40, 48].map(value => <option key={value} value={value}>{value}px</option>)}</select></label>
        <div className="ews-section-actions">{([['up', ArrowUp, 'Move section up'], ['down', ArrowDown, 'Move section down'], ['duplicate', Copy, 'Duplicate section'], ['delete', Trash2, 'Delete section']] as const).map(([action, Icon, label]) => <Button key={action} variant="outline" size="icon" aria-label={label} onClick={() => onSectionAction(action)}><Icon size={15}/></Button>)}</div>
      </> : <>
        <div className="ews-small-tabs" role="group" aria-label="Section source format"><button aria-pressed={format === 'text'} onClick={() => setFormat('text')}>Text</button><button aria-pressed={format === 'html'} onClick={() => setFormat('html')}>HTML</button></div>
        <label>Section content<Textarea rows={12} value={format === 'html' ? blockHtml : plainText(blockHtml)} onChange={event => updateHtml(event.target.value)} className={format === 'html' ? 'font-mono' : ''}/></label>
        {block && <><p className="ews-help">Connected fields use current recipient data. Keep the fields you need in this section.</p><div className="ews-field-list">{block.variables_json?.map(field => <button key={field} onClick={() => updateHtml((format === 'html' ? blockHtml : plainText(blockHtml))+` {{${field}}}`)}>{`{{${field}}}`}</button>)}</div></>}
      </>}
      {section?.type !== 'divider' && section?.type !== 'image' && <Button variant="outline" onClick={onPersonalize}>Insert personal field</Button>}
      <Button variant="outline" onClick={onAsk}>✧ Ask Robbie about this section</Button>
    </fieldset>
  </aside>;
}
