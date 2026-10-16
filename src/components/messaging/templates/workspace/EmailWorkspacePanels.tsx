import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getTemplates } from '@/services/messaging';
import type { MessageTemplate } from '@/types/messaging';
import type { EmailWorkspaceDraft, EmailTemplateSection } from '@/types/emailTemplateWorkspace';
import { PROTECTED_EMAIL_TYPES } from '../templateOverrideDefaults';
import { EmailWorkspaceArtwork } from './EmailWorkspaceArtwork';

export type WorkspacePanel = 'start' | 'library' | 'settings' | 'sections' | 'fields' | 'history' | 'review' | 'artwork' | 'import' | null;
interface Props {
  panel: WorkspacePanel; draft: EmailWorkspaceDraft; template: MessageTemplate | null; busy: boolean;
  onClose: () => void; onStart: (purpose: 'tips' | 'update' | 'blank') => void; onOpen: (template: MessageTemplate) => void;
  onChange: (patch: Partial<EmailWorkspaceDraft>) => void; onAdd: (type: EmailTemplateSection['type']) => void;
  onInsert: (value: string) => void; onUseArtwork: (url: string, alt: string) => void;
  onImport: (html: string) => void; onImportPanel: () => void;
  onNavigatePanel: (panel: WorkspacePanel) => void;
  onSave: (copy?: boolean) => void; onContinue: () => void; onTest: (email: string) => void;
  history: { label: string; draft: EmailWorkspaceDraft }[]; onRestore: (draft: EmailWorkspaceDraft) => void;
}

const titles: Record<NonNullable<WorkspacePanel>, string> = { start: 'What are we creating?', library: 'Open an existing template', settings: 'Template settings', sections: 'Add a section', fields: 'Personalize your email', history: 'Recent changes', review: 'Review your email', artwork: 'Create matching artwork', import: 'Paste or import HTML' };

export function EmailWorkspacePanels(props: Props) {
  const { panel, draft, template, busy, onClose, onChange } = props;
  const [search, setSearch] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [importSource, setImportSource] = useState('');
  const library = useQuery({ queryKey: ['templates', 'workspace-library'], queryFn: () => getTemplates({ channel: 'EMAIL' }), enabled: panel === 'library' });
  const connected = Boolean(template?.editable_content_blocks?.length);
  const fields = ['client_first_name', 'client_name', 'company_name', 'company_email', 'portal_url', 'shoot_address', 'shoot_date', 'shoot_time'];
  return <Dialog open={Boolean(panel)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="ews-dialog max-h-[90dvh] overflow-auto sm:max-w-xl"><DialogTitle>{panel ? titles[panel] : ''}</DialogTitle><DialogDescription className="sr-only">Email workspace controls</DialogDescription>
    {panel === 'start' && <div className="ews-start-options">
      <p>Start with a useful structure. Write it yourself or ask Robbie to draft it.</p>
      <button onClick={() => props.onStart('tips')}><span>01</span><strong>Photographer tips</strong><small>Practical advice, field notes, and team guidance.</small></button>
      <button onClick={() => props.onStart('update')}><span>02</span><strong>Client update</strong><small>Share new information, services, or a helpful announcement.</small></button>
      <button onClick={() => props.onStart('blank')}><span>03</span><strong>Start from scratch</strong><small>Your message, with the existing REPRO email style.</small></button>
      <Button variant="outline" onClick={props.onImportPanel}>Paste or import HTML instead</Button>
    </div>}
    {panel === 'library' && <div className="ews-library"><Input aria-label="Search existing templates" placeholder="Search templates…" value={search} onChange={event => setSearch(event.target.value)}/>{library.isPending ? <p role="status">Loading templates…</p> : library.isError ? <p role="alert">Could not load templates. <button onClick={() => void library.refetch()}>Try again</button></p> : <div>{library.data?.filter(item => (item.name+' '+item.description).toLowerCase().includes(search.toLowerCase())).map(item => <button key={item.id} onClick={() => props.onOpen(item)}><strong>{item.name}</strong><span>{item.is_system ? 'Automated' : item.scope === 'USER' ? 'My template' : 'Shared template'} · {item.category?.toLowerCase()}</span></button>)}{!library.data?.some(item => (item.name+' '+item.description).toLowerCase().includes(search.toLowerCase())) && <p>No matching templates.</p>}</div>}</div>}
    {panel === 'settings' && <fieldset disabled={busy} className="ews-settings">
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => props.onNavigatePanel('start')}>New email</Button><Button variant="outline" onClick={() => props.onNavigatePanel('library')}>Open template</Button><Button variant="outline" onClick={props.onImportPanel}>Import HTML</Button></div>
      <label>Template name<Input value={draft.name} maxLength={255} onChange={event => onChange({ name: event.target.value })}/></label>
      <label>Description<Textarea rows={2} value={draft.description ?? ''} onChange={event => onChange({ description: event.target.value })}/></label>
      <label>Category<select value={draft.category ?? 'GENERAL'} disabled={template?.is_system} onChange={event => onChange({ category: event.target.value as EmailWorkspaceDraft['category'] })}>{['GENERAL', 'BOOKING', 'REMINDER', 'PAYMENT', 'INVOICE', 'ACCOUNT'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Availability<select value={draft.scope} disabled={template?.is_system} onChange={event => onChange({ scope: event.target.value as EmailWorkspaceDraft['scope'] })}>{['USER', 'GLOBAL', 'ACCOUNT', ...(template?.is_system ? ['SYSTEM'] : [])].map(value => <option key={value} value={value}>{value === 'USER' ? 'My templates' : value === 'GLOBAL' ? 'All staff' : value === 'ACCOUNT' ? 'Account' : 'System'}</option>)}</select></label>
      {(template?.email_type || draft.email_type) && <><label>Automated email type<select value={draft.email_type ?? ''} disabled={template?.is_system} onChange={event => onChange({ email_type: event.target.value, override_enabled: Boolean(event.target.value) })}>{PROTECTED_EMAIL_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="ews-checkbox"><input type="checkbox" checked={draft.override_enabled ?? false} onChange={event => onChange({ override_enabled: event.target.checked })}/>Use this saved content for the automated email</label></>}
      <Button onClick={() => props.onSave()}>Save template</Button>
      {template && !connected && !template.is_system && <Button variant="outline" onClick={() => props.onSave(true)}>Save as a new copy</Button>}
    </fieldset>}
    {panel === 'sections' && <div className="ews-section-choices">{(['text', 'tips', 'notice', 'image', 'button', 'divider'] as const).map(type => <button key={type} onClick={() => props.onAdd(type)}><strong>{type === 'text' ? 'Text & heading' : type === 'tips' ? 'Tips / list' : type === 'notice' ? 'Callout' : type === 'image' ? 'Image' : type === 'button' ? 'Button' : 'Divider'}</strong><small>{type === 'image' ? 'Use an image URL or generate artwork' : 'Match the current email style'}</small></button>)}</div>}
    {panel === 'fields' && <div className="ews-personalize"><p>Insert at the current subject or section cursor. Use matching booking or account context when sending.</p>{fields.map(field => <Button key={field} variant="outline" onClick={() => props.onInsert(`{{${field}}}`)}>{`{{${field}}}`}</Button>)}</div>}
    {panel === 'history' && <div className="ews-history"><p>Changes from this editing session. Restoring a version can be undone.</p>{props.history.slice().reverse().map((entry, index) => <button key={index} onClick={() => props.onRestore(entry.draft)}><strong>{entry.label}</strong><span>{entry.draft.subject || 'Untitled subject'}</span></button>)}{!props.history.length && <p>No earlier changes yet.</p>}</div>}
    {panel === 'review' && <div className="ews-review"><span className="ews-eyebrow">READY FOR THE NEXT STEP</span><h3>{draft.subject || 'Add a subject before continuing'}</h3><p>{draft.editor_document_json.preheader}</p><p>Save your template, then choose recipients and review the final message in the email composer.</p>{connected && <p className="ews-help">Automated emails require the correct booking, invoice, or account context. Review the connected data before sending.</p>}<Button disabled={busy} onClick={props.onContinue}>{busy ? 'Saving…' : 'Save & choose recipients'}</Button><hr/><label>Send a test to<Input type="email" value={testEmail} placeholder="you@company.com" onChange={event => setTestEmail(event.target.value)}/></label><Button variant="outline" disabled={busy || !testEmail.trim()} onClick={() => props.onTest(testEmail.trim())}>{template ? 'Send test email' : 'Save & send test email'}</Button><p className="ews-help">The test uses sample recipient and event data. It sends only when you press this button.</p></div>}
    {panel === 'artwork' && <EmailWorkspaceArtwork onUse={props.onUseArtwork}/>}
    {panel === 'import' && <div className="ews-settings"><p className="ews-help">Paste a complete HTML email or fragment. Its layout, styles, and tables will be kept.</p><label>Email HTML<Textarea className="min-h-[240px] font-mono text-xs" value={importSource} placeholder="<!doctype html>…" onChange={event => setImportSource(event.target.value)}/></label><Button disabled={!importSource.trim()} onClick={() => props.onImport(importSource)}>Use this HTML</Button><Button variant="outline" onClick={() => document.getElementById('ews-import')?.click()}>Choose an HTML file</Button></div>}
  </DialogContent></Dialog>;
}
