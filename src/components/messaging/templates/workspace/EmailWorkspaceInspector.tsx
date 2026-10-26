import { lazy, Suspense, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EmailTemplateSection, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { EmailSectionTextField } from './EmailSectionTextField';
import { flattenEmailSections, mapEmailSections } from './emailWorkspaceTree';
import { emailSectionTypes } from './emailWorkspacePresets';
import { saveEmailSection } from '@/services/emailWorkspaceV2';
import { toast } from '@/lib/sonner-toast';
import { plainText } from './emailWorkspaceModel';

const RichText = lazy(() => import('./EmailRichText').then(module => ({ default: module.EmailRichText })));

interface Props {
  selected: string; draft: EmailWorkspaceDraft; template: MessageTemplate | null; disabled: boolean;
  onChange: (next: EmailWorkspaceDraft, label: string) => void;
  onSectionAction: (action: 'up' | 'down' | 'duplicate' | 'delete') => void;
  richInInspector?: boolean; onCopy?: () => void; v2?: boolean; onMedia?: () => void;
  onClose: () => void; onAsk: () => void; onArtwork: () => void; onPersonalize: () => void;
}

export function EmailWorkspaceInspector({ selected, draft, template, disabled, onChange, onSectionAction, onClose, onAsk, onArtwork, onPersonalize, v2, onMedia, richInInspector, onCopy }: Props) {
  const [format, setFormat] = useState<'text' | 'html'>('text');
  const section = flattenEmailSections(draft.editor_document_json.sections).find(item => item.id === selected);
  const block = template?.editable_content_blocks?.find(item => item.key === selected);
  const blockHtml = block ? draft.content_blocks_json?.[block.key]?.body_html ?? block.body_html : draft.body_html ?? '';

  function updateSection(patch: Partial<EmailTemplateSection>) {
    onChange({ ...draft, editor_document_json: { ...draft.editor_document_json,
      version: v2 ? 2 : draft.editor_document_json.version, sections: mapEmailSections(draft.editor_document_json.sections, item => item.id === selected ? { ...item, ...patch } : item) } }, 'Edit section');
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
          updateSection({ type, columns: type === 'columns' ? section.columns ?? [[{ id: crypto.randomUUID(), type: 'text', heading: 'First card', body: '', image_url: '', alt: '', url: '', alignment: 'left', spacing: 24 }], [{ id: crypto.randomUUID(), type: 'text', heading: 'Second card', body: '', image_url: '', alt: '', url: '', alignment: 'left', spacing: 24 }]] : undefined, layout: type === 'feature' ? 'image-left' : 'stacked', tone: ['notice', 'steps', 'details'].includes(type) ? 'soft' : 'plain',
            ...(type === 'feature' && !section.image_url ? { image_url: window.location.origin+'/images/email-atelier/v6/editing.png' } : {}) });
        }}>{Object.entries(v2 ? Object.fromEntries(Object.entries(emailSectionTypes).filter(([type]) => type !== 'columns' || draft.editor_document_json.sections.some(item => item.id === selected))) : { text: 'Body text', hero: 'Headline + hero', feature: 'Image + text', tips: 'Bullet list', steps: 'Numbered steps', details: 'Details card', notice: 'Callout', image: 'Image', button: 'Button', divider: 'Divider' }).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
        {!['image', 'button', 'divider', 'columns', 'spacer'].includes(section.type) && <label>Eyebrow / label<Input value={section.eyebrow ?? ''} placeholder="FOR YOUR NEXT SHOOT" onChange={event => updateSection({ eyebrow: event.target.value })}/></label>}
        {!['image', 'divider'].includes(section.type) && <label>Heading<Input value={section.heading} onChange={event => updateSection({ heading: event.target.value })}/></label>}
        {['text', 'tips', 'notice', 'hero', 'feature', 'steps', 'details', 'quote', 'signature', 'offer', 'faq'].includes(section.type) && (v2 && richInInspector && ['text','hero','feature','notice','quote','offer','signature','faq'].includes(section.type) ? <Suspense fallback={<p>Loading text editor…</p>}><RichText section={section} disabled={disabled} onChange={updateSection}/></Suspense> : <EmailSectionTextField label={section.type === 'tips' ? 'Tips · one per line' : section.type === 'steps' ? 'Steps · one per line' : section.type === 'details' ? 'Details · Label | Value per line' : 'Message'} value={section.body} onChange={body => updateSection({ body, rich_text: undefined })}/>)}
        {v2 && section.type === 'columns' && <label>Columns<select aria-label="Number of columns" value={section.columns?.length ?? 2} onChange={event => { const count = Number(event.target.value); const columns = [...(section.columns ?? [])]; while (columns.length < count) columns.push([{ id: crypto.randomUUID(), type: 'text', heading: 'New card', body: '', image_url: '', alt: '', url: '', alignment: 'left', spacing: 24 }]); if (count < columns.length && !window.confirm('Remove the last column and its content? You can undo this.')) return; updateSection({ columns: columns.slice(0, count) }); }}><option value="2">Two</option><option value="3">Three</option></select></label>}
        {v2 && section.type === 'video' && <label>Video link<Input aria-label="Video link" value={section.video_url ?? ''} placeholder="https://…" onChange={event => updateSection({ video_url: event.target.value })}/></label>}{v2 && section.type === 'video' && <label>Video duration<Input value={section.duration ?? ''} maxLength={30} placeholder="e.g. 2:30" onChange={event => updateSection({ duration: event.target.value })}/></label>}
        {section.type === 'feature' && <label>Image position<select value={section.layout ?? 'image-left'} onChange={event => updateSection({ layout: event.target.value as EmailTemplateSection['layout'] })}>{draft.editor_document_json.sections.some(item => item.id === section.id) && <><option value="image-left">Image left of text</option><option value="image-right">Image right of text</option></>}<option value="stacked">Image above text</option></select></label>}
        {!['image', 'button', 'divider', 'columns', 'spacer'].includes(section.type) && <label>Section background<select value={section.tone ?? 'plain'} onChange={event => updateSection({ tone: event.target.value as EmailTemplateSection['tone'] })}><option value="plain">White / email background</option><option value="soft">Soft card</option><option value="accent">Navy feature card</option></select></label>}
        {['image', 'feature', 'hero', 'video'].includes(section.type) && <>{v2 && <Button variant="outline" onClick={onMedia}>Upload / choose image or thumbnail</Button>}<label>Image URL<Input type="url" value={section.image_url} onChange={event => updateSection({ image_url: event.target.value, image_prompt: '', artwork_id: null, media_id: undefined })}/></label><label>Image description<Input value={section.alt} onChange={event => updateSection({ alt: event.target.value })}/></label><label>Existing brand artwork<select value="" onChange={event => { if (event.target.value) updateSection({ image_url: window.location.origin+'/images/email-atelier/v6/'+event.target.value+'.png', image_prompt: '', artwork_id: null, media_id: undefined }); }}><option value="">Choose an existing image…</option>{['editing', 'invoice', 'invoice_pending_approval', 'invoice_approved', 'schedule', 'delivery_access', 'welcome'].map(key => <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>)}</select></label>
        {section.type === 'feature' && <label>Image width<select value={section.image_width ?? 160} onChange={event => updateSection({ image_width: Number(event.target.value) })}>{[80, 120, 160, 200, 240, 280].map(width => <option key={width} value={width}>{width}px</option>)}</select></label>}
        <Button variant="outline" onClick={onArtwork}>{section.image_url ? 'Regenerate transparent PNG' : 'Generate PNG artwork'}</Button><p className="ews-help">Choose a transparent icon or a wide header. Leave the description empty for a decorative image.</p></>}
        {v2 && ['image','hero','feature','video'].includes(section.type) && <><label>Caption<Input value={section.caption ?? ''} onChange={event => updateSection({ caption: event.target.value })}/></label><label>Image click-through link<Input value={section.image_link ?? ''} placeholder="https://…" onChange={event => updateSection({ image_link: event.target.value })}/></label><label>Image fit<select value={section.styles?.fit ?? 'contain'} onChange={event => updateSection({ styles: { ...section.styles, fit: event.target.value as 'contain' | 'cover' } })}><option value="contain">Fit entire image</option><option value="cover">Fill / crop</option></select></label><label>Aspect ratio<select value={section.styles?.aspect ?? 'auto'} onChange={event => updateSection({ styles: { ...section.styles, aspect: event.target.value as NonNullable<EmailTemplateSection['styles']>['aspect'] } })}>{['auto','1:1','3:2','16:9','12:5'].map(value => <option key={value}>{value}</option>)}</select></label></>}
        {section.type === 'button' && <label>Button link<Input value={section.url} placeholder="https://… or {{portal_url}}" onChange={event => updateSection({ url: event.target.value })}/></label>}
        <label>Alignment<select value={section.alignment} onChange={event => updateSection({ alignment: event.target.value as EmailTemplateSection['alignment'] })}><option>left</option><option>center</option><option>right</option></select></label>
        <label>Space below<select value={section.spacing} onChange={event => updateSection({ spacing: Number(event.target.value) })}>{[8, 16, 24, 32, 40, 48].map(value => <option key={value} value={value}>{value}px</option>)}</select></label>
        {v2 && <details><summary>Design settings</summary>{([['font_size','Text size',12,48],['padding','Padding',0,48],['radius','Rounded corners',0,24]] as const).map(([key,label,min,max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={section.styles?.[key] ?? (key === 'font_size' ? 16 : 0)} onChange={event => updateSection({ styles: { ...section.styles, [key]: Math.max(min, Math.min(max, Number(event.target.value))) } })}/></label>)}<label>Section color<input type="color" value={section.styles?.background ?? '#ffffff'} onChange={event => updateSection({ styles: { ...section.styles, background: event.target.value } })}/></label><label>Text color<input type="color" value={section.styles?.color ?? '#09223c'} onChange={event => updateSection({ styles: { ...section.styles, color: event.target.value } })}/></label><Button variant="ghost" onClick={() => updateSection({ styles: undefined })}>Reset design</Button></details>}
        {v2 && <Button variant="outline" onClick={onCopy}>Copy section</Button>}
        {v2 && <Button variant="outline" onClick={async () => { try { await saveEmailSection(section.heading || emailSectionTypes[section.type], section); toast.success('Reusable section saved'); } catch { toast.error('Could not save this section.'); } }}>Save reusable section</Button>}
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
