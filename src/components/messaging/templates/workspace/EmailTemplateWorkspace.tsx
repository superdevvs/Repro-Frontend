import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Code, Download, Monitor, Moon, Smartphone, Sparkles, Sun } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from '@/lib/sonner-toast';
import { createTemplate, previewTemplate, testSendTemplate, updateTemplate } from '@/services/messaging';
import { suggestEmailTemplate } from '@/services/emailTemplateWorkspace';
import type { EmailAssistantContext, EmailTemplateSection, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { getTemplateErrorMessage } from '../templatePreviewSupport';
import { TemplateRenderedPreview } from '../TemplateRenderedPreview';
import { EmailWorkspaceCanvas } from './EmailWorkspaceCanvas';
import { EmailWorkspaceInspector } from './EmailWorkspaceInspector';
import { EmailWorkspacePanels, type WorkspacePanel } from './EmailWorkspacePanels';
import { EmailWorkspaceChrome, type EmailWorkspaceMode } from './EmailWorkspaceChrome';
import { newSection, normalizeEmailDocument, plainText, savePayload, startingEmail, validateWorkspaceDraft } from './emailWorkspaceModel';
import { useSuggestedEmailArtwork } from './useSuggestedEmailArtwork';
import { useEmailTemplateDraft } from './useEmailTemplateDraft';
import './emailWorkspace.css';

interface Props { template: MessageTemplate | null; open: boolean; onClose: () => void; onSuccess: (template: MessageTemplate) => void }
function attachArtwork(target: EmailWorkspaceDraft, ready: Map<string, string>): EmailWorkspaceDraft {
  if (!target.editor_document_json.sections.some(section => section.artwork_id && ready.has(section.artwork_id) && section.image_url !== ready.get(section.artwork_id))) return target;
  return { ...target, editor_document_json: { ...target.editor_document_json, sections: target.editor_document_json.sections.map(section => section.artwork_id && ready.has(section.artwork_id) ? { ...section, image_url: ready.get(section.artwork_id)! } : section) } };
}
export function EmailTemplateWorkspace({ template: initialTemplate, open, onClose, onSuccess }: Props) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTablet = useMediaQuery('(max-width: 1100px)');
  const sectionOverlay = isMobile || isTablet;
  const editor = useEmailTemplateDraft(initialTemplate);
  const { template, draft, dirty } = editor;
  const [panel, setPanel] = useState<WorkspacePanel>(initialTemplate ? null : 'start');
  const [mode, setMode] = useState<EmailWorkspaceMode>('edit');
  const [selected, setSelected] = useState<string | null>(null);
  const [preheaderOpen, setPreheaderOpen] = useState(false);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mobilePanel, setMobilePanel] = useState<'email' | 'robbie'>('email');
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [sectionPanelOpen, setSectionPanelOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [scope, setScope] = useState<'email' | 'subject' | 'section'>('email');
  const [busy, setBusy] = useState<'save' | 'robbie' | 'test' | null>(null);
  const [pending, setPendingState] = useState<EmailWorkspaceDraft | null>(null);
  const pendingDraft = useRef<EmailWorkspaceDraft | null>(null);
  function setPending(next: EmailWorkspaceDraft | null) { pendingDraft.current = next; setPendingState(next); }
  const [proposed, setProposed] = useState(true);
  const [autoArtwork, setAutoArtwork] = useState(true);
  const [assistantContext, setAssistantContext] = useState<EmailAssistantContext | null>(null);
  const suggestedArtwork = useSuggestedEmailArtwork(pending ?? draft, Boolean(pending && autoArtwork), Boolean(busy), images => {
    const ready = new Map(images.map(image => [image.id, image.url]));
    if (pendingDraft.current) {
      const next = attachArtwork(pendingDraft.current, ready);
      if (next !== pendingDraft.current) setPending(next);
    } else editor.replace(current => attachArtwork(current, ready), 'Generated artwork ready', false);
  });
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const fieldTarget = useRef<{ element: HTMLInputElement | HTMLTextAreaElement; start: number; end: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const visible = pending && proposed ? pending : draft;
  const previewDraft = useMemo(() => savePayload(visible, template), [visible, template]);
  const disabled = Boolean(pending || busy);
  const document = visible.editor_document_json;
  const connected = Boolean(template?.editable_content_blocks?.length);
  const source = useQuery({
    queryKey: ['workspace-html-source', template?.id, visible],
    queryFn: () => previewTemplate(template?.id ?? null, undefined, { template: previewDraft }),
    enabled: mode === 'html' && document.format === 'sections', retry: false,
  });
  const htmlSource = document.format === 'sections' ? source.data?.source_html ?? '' : visible.body_html ?? '';

  function change(next: EmailWorkspaceDraft, label = 'Edit email', group = true) {
    if (!disabled) editor.replace(next, label, group);
  }
  function start(purpose: 'tips' | 'update' | 'blank') {
    if (dirty && !window.confirm('Start a new email? Your current unsaved changes will be replaced.')) return;
    editor.load(null, startingEmail(purpose)); setPanel(null); setMode('edit'); setSelected(null); setPending(null); setAssistantContext(null); setChat([]);
  }
  function openTemplate(next: MessageTemplate) {
    if (dirty && !window.confirm('Open this template? Your current unsaved changes will be replaced.')) return;
    editor.load(next); setPanel(null); setSelected(null); setMode(next.editor_document_json?.format === 'html' ? 'html' : 'edit'); setPending(null); setAssistantContext(null); setChat([]);
  }
  function close() { if (!dirty || window.confirm('Close the editor? You can restore your local draft when you reopen it.')) { editor.stash(); onClose(); } }

  async function save(copy = false): Promise<MessageTemplate | null> {
    const error = validateWorkspaceDraft(draft);
    if (error) { toast.error(error); return null; }
    if (disabled) return null;
    setBusy('save');
    try {
      const payload = { ...savePayload(draft, template), ...(copy ? { name: draft.name+' (Copy)', scope: 'USER' as const, override_enabled: false } : {}) };
      const saved = template && !copy ? await updateTemplate(template.id, payload) : await createTemplate({ ...payload, is_active: true });
      editor.markSaved(saved); onSuccess(saved); toast.success(copy ? 'Template copy saved' : 'Template saved'); setPanel(null); return saved;
    } catch (error) { toast.error(getTemplateErrorMessage(error, 'Could not save your template. Your changes are still here.')); return null; }
    finally { setBusy(null); }
  }

  async function askRobbie() {
    if (!instruction.trim() || disabled) return;
    if (scope === 'section' && (!selected || selected === '__body')) { toast.error('Select a section, or choose Whole email.'); return; }
    const request = instruction.trim(); setBusy('robbie');
    setChat(current => [...current, { role: 'user', text: request }]);
    try {
      const { assistant_context, ...proposal } = await suggestEmailTemplate({ template_id: template?.id, instruction: request, scope, section_id: selected ?? undefined, draft: savePayload(draft, template) });
      setAssistantContext(assistant_context ?? null);
      if (scope === 'email') setMode('preview');
      setPending({ ...draft, ...proposal, editor_document_json: normalizeEmailDocument(proposal.editor_document_json ?? draft.editor_document_json) }); setProposed(true); setInstruction(''); setSelected(null); setScope('email'); setMobilePanel('email');
      setChat(current => [...current, { role: 'assistant', text: 'Your suggestion is ready. Compare it with your original, then apply it or keep editing your current version.' }]);
    } catch (error) { toast.error(getTemplateErrorMessage(error, 'Robbie could not prepare that revision. Your draft is unchanged.')); }
    finally { setBusy(null); }
  }

  function addSection(type: EmailTemplateSection['type']) {
    const section = newSection(type);
    if (type === 'image' || type === 'feature') section.image_url = window.location.origin+'/images/email-atelier/v6/editing.png';
    change({ ...draft, editor_document_json: { ...draft.editor_document_json, sections: [...draft.editor_document_json.sections, section] } }, 'Add '+type, false);
    setSelected(section.id); setSectionPanelOpen(true); setPanel(null);
  }
  function sectionAction(action: 'up' | 'down' | 'duplicate' | 'delete') {
    const sections = [...draft.editor_document_json.sections], index = sections.findIndex(section => section.id === selected);
    if (index < 0) return;
    if (action === 'delete') { sections.splice(index, 1); setSelected(null); }
    if (action === 'duplicate') { const copy = { ...sections[index], id: crypto.randomUUID() }; sections.splice(index+1, 0, copy); setSelected(copy.id); }
    const target = action === 'up' ? index-1 : action === 'down' ? index+1 : -1;
    if (target >= 0 && target < sections.length) [sections[index], sections[target]] = [sections[target], sections[index]];
    change({ ...draft, editor_document_json: { ...draft.editor_document_json, sections } }, action+' section', false);
  }

  function importHtml(html: string, filename?: string) {
    if (disabled) return;
    if (html.length > 250000) { toast.error('Choose an HTML file smaller than 250 KB.'); return; }
    if (connected) { toast.error('This automated email has connected content. Edit its sections or HTML wrapper while keeping the live fields.'); return; }
    if (dirty && !window.confirm('Replace the email content with this HTML? You can undo this change.')) return;
    const title = new DOMParser().parseFromString(html, 'text/html').title;
    change({ ...draft, name: draft.name === 'Untitled email' ? title || filename?.replace(/\.html?$/i, '') || 'Imported HTML email' : draft.name,
      body_html: html, body_text: plainText(html), editor_document_json: { version: 1, format: 'html', preheader: '', sections: [] } }, 'Import HTML', false);
    setMode('html'); setPanel(null); setSelected(null);
  }

  function editSource(html: string) {
    const completeDocument = /<(?:!doctype\s+html|html(?:\s|>))/i.test(html);
    change({ ...draft, body_html: html, body_text: plainText(html), editor_document_json: { ...draft.editor_document_json,
      format: draft.editor_document_json.format === 'legacy' && (connected || !completeDocument) ? 'legacy' : 'html', sections: [] } }, 'Edit HTML');
  }
  function insertField(value: string) {
    const target = fieldTarget.current;
    if (target?.element.isConnected) {
      const { element, start, end } = target;
      const next = element.value.slice(0, start)+value+element.value.slice(end);
      if (element === subjectRef.current) change({ ...draft, subject: next }, 'Insert subject field', false);
      else if (element === sourceRef.current) editSource(next);
      else {
        // Native React value setters let the existing field editor own its update.
        const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, next);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      setPanel(null); window.setTimeout(() => { element.focus(); element.setSelectionRange(start+value.length, start+value.length); }, 0); return;
    }
    toast.info('Click the text field where you want to insert a personal field first.'); setPanel(null);
  }
  function useArtwork(url: string, alt: string, kind: 'header' | 'icon' | 'illustration') {
    const selectedImage = draft.editor_document_json.sections.find(section => section.id === selected && ['image', 'hero', 'feature'].includes(section.type));
    const current = kind === 'header' ? selectedImage && ['hero', 'image'].includes(selectedImage.type) ? selectedImage : draft.editor_document_json.sections.find(section => section.type === 'hero') : selectedImage;
    const image = { ...newSection('image'), image_url: url, alt: alt.slice(0, 500) };
    if (draft.editor_document_json.format !== 'sections') {
      const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const markup = '<p><img src="'+escape(url)+'" alt="'+escape(alt.slice(0, 500))+'" width="520" style="display:block;max-width:100%;height:auto;margin:0 auto;"></p>';
      const block = template?.editable_content_blocks?.find(item => item.key === selected);
      if (block) {
        const content = draft.content_blocks_json?.[block.key] ?? block;
        change({ ...draft, content_blocks_json: { ...draft.content_blocks_json, [block.key]: { body_html: kind === 'header' ? markup+content.body_html : content.body_html+markup, body_text: content.body_text } } }, 'Add generated artwork', false);
      } else {
        const html = draft.body_html ?? '';
        const next = kind === 'header' ? /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, opening => opening+markup) : markup+html : /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => markup+'</body>') : html+markup;
        change({ ...draft, body_html: next }, 'Add generated artwork', false);
      }
      setPanel(null); return;
    }
    change({ ...draft, editor_document_json: { ...draft.editor_document_json,
      sections: current ? draft.editor_document_json.sections.map(section => section.id === current.id ? { ...section, image_url: url, alt: alt.slice(0, 500), image_prompt: '', artwork_id: null } : section) : kind === 'header' ? [image, ...draft.editor_document_json.sections] : [...draft.editor_document_json.sections, image] } }, 'Add generated artwork', false);
    setSelected(current?.id ?? image.id); setPanel(null);
  }
  async function testSend(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Enter a valid test email address.'); return; }
    const error = validateWorkspaceDraft(draft);
    if (error) { toast.error(error); return; }
    const existing = template;
    const saved = existing ?? await save(); if (!saved) return;
    setPanel('review'); setBusy('test');
    try { await testSendTemplate(saved.id, { to: email, ...(existing ? { template: savePayload(draft, existing) } : {}) }); toast.success('Test email sent to '+email); }
    catch (error) { toast.error(getTemplateErrorMessage(error, 'The test email could not be sent.')); }
    finally { setBusy(null); }
  }
  async function continueToRecipients() {
    if (suggestedArtwork.running) { toast.info('Artwork is still generating. You can keep editing while it finishes.'); return; }
    const saved = await save(); if (!saved) return;
    onClose(); navigate('/messaging/email/compose', { state: { mode: 'compose', prefillTemplateId: saved.id } });
  }

  const sectionEditor = selected && mode === 'edit' && <div className="ews-section-container" onFocusCapture={event => { const element = event.target; if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) fieldTarget.current = { element, start: element.selectionStart ?? element.value.length, end: element.selectionEnd ?? element.value.length }; }} onSelectCapture={event => { const element = event.target; if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) fieldTarget.current = { element, start: element.selectionStart ?? element.value.length, end: element.selectionEnd ?? element.value.length }; }}><EmailWorkspaceInspector key={selected} selected={selected} draft={draft} template={template} disabled={disabled} onChange={(next, label) => change(next, label)} onSectionAction={sectionAction} onClose={() => setSelected(null)} onAsk={() => { setScope(selected === '__body' ? 'email' : 'section'); setAssistantOpen(true); setMobilePanel('robbie'); setSectionPanelOpen(false); window.setTimeout(() => promptRef.current?.focus(), 0); }} onArtwork={() => { setSectionPanelOpen(false); setPanel('artwork'); }} onPersonalize={() => setPanel('fields')}/></div>;
  const canvas = <EmailWorkspaceCanvas draft={visible} template={template} selected={selected} disabled={disabled} artwork={suggestedArtwork.images} onSelect={id => { setSelected(id); setSectionPanelOpen(true); setMode('edit'); }} onAdd={() => setPanel('sections')}/>;
  const artworkPreview = { artwork: suggestedArtwork.images, fallback: document.format === 'sections' ? canvas : undefined };

  return <Dialog open={open} onOpenChange={value => { if (!value) close(); }}><DialogContent className="ews-shell" data-mobile={isMobile} onInteractOutside={event => event.preventDefault()}>
    <DialogTitle className="sr-only">Robbie email workspace</DialogTitle><DialogDescription className="sr-only">Create and edit email templates manually, in HTML, or with Robbie.</DialogDescription>
    <EmailWorkspaceChrome name={draft.name} status={dirty ? 'Unsaved changes' : template ? 'All changes saved' : 'New template'} saving={busy === 'save'} disabled={disabled}
      mode={mode} assistantOnly={isMobile && mobilePanel === 'robbie'} assistantActive={isMobile ? mobilePanel === 'robbie' : assistantOpen}
      reviewDisabled={suggestedArtwork.running} canUndo={Boolean(editor.past.length)} canRedo={Boolean(editor.future.length)} canAdd={document.format === 'sections'}
      onClose={close} onSave={() => void save()} onPanel={setPanel} onUndo={editor.undo} onRedo={editor.redo}
      onMode={value => { setMode(value); setSelected(null); setMobilePanel('email'); }}
      onAssistant={() => { if (isMobile) { setMobilePanel(mobilePanel === 'robbie' ? 'email' : 'robbie'); setSectionPanelOpen(false); } else setAssistantOpen(!assistantOpen); }}/>
    <main className="ews-workspace" data-mobile-panel={mobilePanel} data-assistant-open={assistantOpen}>
      <aside className="ews-robbie" aria-label="Robbie assistant" hidden={isMobile ? mobilePanel !== 'robbie' : !assistantOpen}><div className="ews-robbie-heading"><span><Sparkles size={19}/></span><div><h2>Robbie</h2><p>Draft and refine your email</p></div></div><div className="ews-conversation" aria-live="polite"><div className="ews-welcome"><h3>How can I help?</h3><p>Start fresh, open a template, or select a section. Tell me what you need and we’ll shape it together.</p>{['Write a helpful email with photographer preparation tips', 'Create a client update using the details I provide', 'Make this email shorter and warmer'].map(text => <button key={text} disabled={disabled} onClick={() => { setInstruction(text); promptRef.current?.focus(); }}>{text}<span>↗</span></button>)}</div>{chat.map((message, index) => <div key={index} className={'ews-chat ews-chat-'+message.role}>{message.role === 'assistant' && <strong>✧ Robbie</strong>}<p>{message.text}</p></div>)}{busy === 'robbie' && <p role="status">✧ Robbie is preparing a suggestion…</p>}</div><div className="ews-composer"><label>Change<select value={scope} disabled={disabled} onChange={event => setScope(event.target.value as typeof scope)}><option value="email">Whole email</option><option value="subject">Subject & preview text</option><option value="section" disabled={!selected || selected === '__body'}>Selected section</option></select></label><Textarea ref={promptRef} rows={4} aria-label="Ask Robbie" placeholder="Tell Robbie what to create or change…" value={instruction} disabled={disabled} onChange={event => setInstruction(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void askRobbie(); }}/><label className="ews-auto-artwork"><input type="checkbox" checked={autoArtwork} disabled={disabled} onChange={event => setAutoArtwork(event.target.checked)}/>Generate suggested artwork <span>up to 3 images</span></label><div><span>Review every change.</span><Button onClick={() => void askRobbie()} disabled={disabled || !instruction.trim()}><Sparkles size={14}/>Ask Robbie ↑</Button></div></div></aside>
      <section className="ews-editor" aria-label="Email editor" hidden={isMobile && mobilePanel === 'robbie'} onFocusCapture={event => { const element = event.target; if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) fieldTarget.current = { element, start: element.selectionStart ?? element.value.length, end: element.selectionEnd ?? element.value.length }; }} onSelectCapture={event => { const element = event.target; if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) fieldTarget.current = { element, start: element.selectionStart ?? element.value.length, end: element.selectionEnd ?? element.value.length }; }}>
        {editor.recovery && <div className="ews-recovery"><span>An unsaved local draft is available.</span><button onClick={() => editor.recover(true)}>Restore</button><button onClick={() => editor.recover(false)}>Discard</button></div>}
        {pending && <div className="ews-suggestion"><div><strong>Robbie’s suggestion</strong><span>Your current email is kept until you apply.</span></div><div className="ews-small-tabs"><button aria-pressed={!proposed} onClick={() => setProposed(false)}>Original</button><button aria-pressed={proposed} onClick={() => setProposed(true)}>Proposed</button></div><Button size="sm" onClick={() => { const proposal = pendingDraft.current; if (!proposal) return; setPending(null); editor.replace(proposal, 'Apply Robbie suggestion'); setMode('edit'); }}>Apply changes</Button><Button size="sm" variant="ghost" onClick={() => { setPending(null); setAssistantContext(null); }}>Discard</Button></div>}
        {suggestedArtwork.total > 0 && <div className="ews-artwork-progress" role="status">{suggestedArtwork.running ? `Creating matching artwork · ${suggestedArtwork.completed}/${suggestedArtwork.total} ready. You can keep editing; each ready image is added as an unsaved change.` : suggestedArtwork.failed ? 'Some artwork could not be confirmed. Existing brand images are kept; you can apply them or check the same requests again.' : `Your generated artwork is in place. You can replace any image${pending ? ' after applying' : ''}.`}{suggestedArtwork.failed && <Button size="sm" variant="ghost" onClick={suggestedArtwork.retry}>Check artwork again</Button>}</div>}
        {assistantContext && <details className="ews-dashboard-context"><summary>Dashboard context · {assistantContext.sources.length ? `${assistantContext.sources.length} guides used` : 'No matching guide'}</summary>{assistantContext.sources.length ? <ul>{assistantContext.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul> : <p>Check any dashboard instructions before sending. Robbie used your supplied details.</p>}</details>}
        <div className={'ews-canvas-scroll ews-viewport-'+viewport} id="ews-email-panel" role="tabpanel" aria-labelledby={'ews-mode-'+mode}>
          <div className="ews-envelope"><div className="ews-subject"><label htmlFor="ews-subject">Subject</label><Input id="ews-subject" aria-label="Email subject" ref={subjectRef} maxLength={255} value={visible.subject ?? ''} placeholder="Add a subject…" disabled={disabled} onChange={event => change({ ...draft, subject: event.target.value }, 'Edit subject')}/><button aria-expanded={preheaderOpen} aria-controls="ews-preheader" onClick={() => setPreheaderOpen(!preheaderOpen)}>Preview text<ChevronDown size={13}/></button></div>{preheaderOpen && <label id="ews-preheader" className="ews-preheader">Inbox preview<Input aria-label="Email preview text" maxLength={255} value={document.preheader} disabled={disabled} placeholder="A short line beside the subject in the inbox" onChange={event => change({ ...draft, editor_document_json: { ...document, preheader: event.target.value } }, 'Edit preview text')}/>{document.format === 'html' && <small>Add the inbox preheader to your supplied HTML for it to appear in the sent email.</small>}</label>}</div>
          {mode === 'edit' && document.format !== 'html' ? canvas
            : mode === 'html' ? <div className="ews-html-workbench"><div className="ews-html-notice"><Code size={15}/><span>{connected ? 'The wrapper contains live fields. Edit individual sections in Edit email.' : document.format === 'sections' ? 'Editing this HTML switches to an HTML template. Undo returns to sections.' : 'Your original HTML and CSS are preserved.'}</span><Button size="sm" variant="ghost" disabled={!htmlSource} onClick={() => { const url = URL.createObjectURL(new Blob([htmlSource], { type: 'text/html' })); const link = window.document.createElement('a'); link.href = url; link.download = draft.name.replace(/[^a-z0-9 _-]/gi, '')+'.html'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><Download size={14}/>Download</Button></div><div className="ews-html-grid"><label>HTML source<Textarea ref={sourceRef} aria-label="Email HTML content" spellCheck={false} value={htmlSource} disabled={disabled || (document.format === 'sections' && !source.data)} onChange={event => editSource(event.target.value)} onPaste={event => { if (document.format === 'sections' && !htmlSource) { event.preventDefault(); importHtml(event.clipboardData.getData('text')); } }}/>{source.isError && <button onClick={() => void source.refetch()}>Could not prepare source. Retry</button>}</label><TemplateRenderedPreview {...artworkPreview} compact templateId={template?.id ?? null} draft={previewDraft} enabled={open} theme={theme} viewport={viewport} onThemeChange={setTheme} onViewportChange={setViewport}/></div></div>
            : <TemplateRenderedPreview {...artworkPreview} compact templateId={template?.id ?? null} draft={previewDraft} enabled={open} theme={theme} viewport={viewport} onThemeChange={setTheme} onViewportChange={setViewport}/>}
        </div><div className="ews-status"><span>{connected ? 'Live fields connected' : document.format === 'html' ? 'Original HTML layout' : 'No booking details required'}</span>{mode !== 'edit' || document.format === 'html' ? <div role="group" aria-label="Email preview appearance"><button aria-label="Desktop preview" title="Desktop email preview" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}><Monitor size={16}/></button><button aria-label="Mobile preview" title="Mobile email preview" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}><Smartphone size={16}/></button><button aria-label={theme === 'light' ? 'Preview dark email' : 'Preview light email'} title="Changes the email preview only" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}<span>Email: {theme}</span></button></div> : <span>Content editor</span>}</div>
      </section>
      {!sectionOverlay && sectionEditor}
    </main>
    {sectionOverlay && <Dialog open={Boolean(sectionEditor) && sectionPanelOpen} onOpenChange={value => { if (!value) { setSectionPanelOpen(false); setSelected(null); } }}><DialogContent className="ews-section-dialog" data-mobile={isMobile} onCloseAutoFocus={event => { if (panel) event.preventDefault(); if (mobilePanel === 'robbie') { event.preventDefault(); promptRef.current?.focus(); } }}><DialogTitle className="sr-only">Edit email section</DialogTitle><DialogDescription className="sr-only">Edit the selected section manually or ask Robbie to revise it.</DialogDescription>{sectionEditor}</DialogContent></Dialog>}
    <input id="ews-import" ref={fileRef} type="file" accept=".html,.htm,text/html" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) { if (file.size > 250000) toast.error('Choose an HTML file smaller than 250 KB.'); else void file.text().then(value => importHtml(value, file.name)); } event.target.value = ''; }}/>
    <EmailWorkspacePanels panel={panel} draft={draft} template={template} busy={Boolean(busy)} onClose={() => setPanel(null)} onStart={start} onOpen={openTemplate} onChange={patch => change({ ...draft, ...patch }, 'Edit settings')} onAdd={addSection} onInsert={insertField} onUseArtwork={useArtwork} artworkTarget={draft.editor_document_json.sections.find(section => section.id === selected)} onImport={importHtml} onNavigatePanel={setPanel} onImportPanel={() => setPanel('import')} onSave={copy => void save(copy)} onContinue={() => void continueToRecipients()} onTest={email => void testSend(email)} history={editor.past} onRestore={next => { change(next, 'Restore version', false); setPanel(null); }} />
  </DialogContent></Dialog>;
}
