import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EmailTemplateSection, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { EmailSectionTextField } from './EmailSectionTextField';
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
        <label>Section layout<select value={section.type} onChange={event => {
          const type = event.target.value as EmailTemplateSection['type'];
          updateSection({ type, layout: type === 'feature' ? 'image-left' : 'stacked', tone: ['notice', 'steps', 'details'].includes(type) ? 'soft' : 'plain',
            ...(type === 'feature' && !section.image_url ? { image_url: window.location.origin+'/images/email-atelier/v6/editing.png' } : {}) });
        }}>{Object.entries({ text: 'Body text', hero: 'Headline + hero', feature: 'Image + text', tips: 'Bullet list', steps: 'Numbered steps', details: 'Details card', notice: 'Callout', image: 'Image', button: 'Button', divider: 'Divider' }).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
        {!['image', 'button', 'divider'].includes(section.type) && <label>Eyebrow / label<Input value={section.eyebrow ?? ''} placeholder="FOR YOUR NEXT SHOOT" onChange={event => updateSection({ eyebrow: event.target.value })}/></label>}
        {!['image', 'divider'].includes(section.type) && <label>Heading<Input value={section.heading} onChange={event => updateSection({ heading: event.target.value })}/></label>}
        {['text', 'tips', 'notice', 'hero', 'feature', 'steps', 'details'].includes(section.type) && <EmailSectionTextField label={section.type === 'tips' ? 'Tips · one per line' : section.type === 'steps' ? 'Steps · one per line' : section.type === 'details' ? 'Details · Label | Value per line' : 'Message'} value={section.body} onChange={body => updateSection({ body })}/>}
        {section.type === 'feature' && <label>Image position<select value={section.layout ?? 'image-left'} onChange={event => updateSection({ layout: event.target.value as EmailTemplateSection['layout'] })}><option value="image-left">Image left of text</option><option value="image-right">Image right of text</option><option value="stacked">Image above text</option></select></label>}
        {!['image', 'button', 'divider'].includes(section.type) && <label>Section background<select value={section.tone ?? 'plain'} onChange={event => updateSection({ tone: event.target.value as EmailTemplateSection['tone'] })}><option value="plain">White / email background</option><option value="soft">Soft card</option><option value="accent">Navy feature card</option></select></label>}
        {['image', 'feature', 'hero'].includes(section.type) && <><label>Image URL<Input type="url" value={section.image_url} onChange={event => updateSection({ image_url: event.target.value, image_prompt: '', artwork_id: null })}/></label><label>Image description<Input value={section.alt} onChange={event => updateSection({ alt: event.target.value })}/></label><label>Existing brand artwork<select value="" onChange={event => { if (event.target.value) updateSection({ image_url: window.location.origin+'/images/email-atelier/v6/'+event.target.value+'.png', image_prompt: '', artwork_id: null }); }}><option value="">Choose an existing image…</option>{['editing', 'invoice', 'invoice_pending_approval', 'invoice_approved', 'schedule', 'delivery_access', 'welcome'].map(key => <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>)}</select></label>
        {section.type === 'feature' && <label>Image width<select value={section.image_width ?? 160} onChange={event => updateSection({ image_width: Number(event.target.value) })}>{[80, 120, 160, 200, 240, 280].map(width => <option key={width} value={width}>{width}px</option>)}</select></label>}
        <Button variant="outline" onClick={onArtwork}>Generate / replace artwork</Button><p className="ews-help">Leave the description empty for a decorative image.</p></>}
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
