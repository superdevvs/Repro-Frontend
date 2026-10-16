import type { EmailWorkspaceDraft, EmailTemplateSection } from '@/types/emailTemplateWorkspace';
import type { MessageTemplate } from '@/types/messaging';
import { getTemplateOverrideDefaults } from '../templateOverrideDefaults';

export const newSection = (type: EmailTemplateSection['type'] = 'text'): EmailTemplateSection => ({
  id: crypto.randomUUID(), type, heading: type === 'button' ? 'Learn more' : type === 'tips' ? 'A few useful tips' : '',
  body: '', image_url: '', alt: '', url: '', alignment: 'left', spacing: 24,
});

export function initialEmailDraft(template: MessageTemplate | null): EmailWorkspaceDraft {
  const defaults = template ? getTemplateOverrideDefaults(template) : { emailType: '', overrideEnabled: false };
  return {
    channel: 'EMAIL', name: template?.name ?? 'Untitled email', description: template?.description ?? '',
    category: template?.category ?? 'GENERAL', scope: template?.scope ?? 'USER',
    subject: template?.editable_subject ?? template?.subject ?? '',
    body_html: template?.editable_content_blocks?.length ? template.body_html : template?.editable_body_html ?? template?.body_html ?? '',
    body_text: template?.body_text ?? '', email_type: defaults.emailType, override_enabled: defaults.overrideEnabled,
    content_blocks_json: template?.content_blocks_json ?? {},
    editor_document_json: structuredClone(template?.editor_document_json ?? {
      version: 1, format: template ? 'legacy' : 'sections', preheader: '', sections: template ? [] : [newSection()],
    }),
  };
}

export function startingEmail(purpose: 'tips' | 'update' | 'blank'): EmailWorkspaceDraft {
  const draft = initialEmailDraft(null);
  if (purpose === 'blank') return draft;
  const tips = purpose === 'tips';
  draft.name = tips ? 'Photographer field notes' : 'A note for our clients';
  draft.subject = tips ? 'A few tips for your next shoot' : 'A quick update from R/E Pro Photos';
  draft.editor_document_json.preheader = tips ? 'Small preparations. Better photographs.' : 'Here’s what you need to know.';
  draft.editor_document_json.sections = [
    { ...newSection(), heading: tips ? 'Good preparation makes the difference.' : 'Keeping you in the loop.', body: (tips ? 'Hi team,\nA few practical reminders for your next shoot.' : 'Hello,\nWe have an update to share with you.') },
    tips ? { ...newSection('tips'), heading: 'Before you arrive', body: 'Review the shoot brief and property access instructions.\nCheck your equipment and batteries before leaving.\nShare any questions with the team ahead of the shoot.' }
      : { ...newSection(), heading: 'What’s new', body: 'Add the details of your update here. Explain what changed, why it helps, and what your clients should do next.' },
    { ...newSection(), body: 'Have a question? Reply to this email and our team will help.\nThe R/E Pro Photos team' },
  ];
  return draft;
}

export const plainText = (html: string) => {
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, '\n'), 'text/html');
  doc.querySelectorAll('script,style,head').forEach(node => node.remove());
  return (doc.body.textContent ?? '').trim();
};

export function safeEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,svg,math,video,audio').forEach(node => node.remove());
  doc.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attribute => {
      if (!['colspan', 'rowspan'].includes(attribute.name)) node.removeAttribute(attribute.name);
    });
    if (node.tagName === 'IMG') node.replaceWith(doc.createTextNode('[Image]'));
  });
  return doc.body.innerHTML;
}

export function safeEmailPreview(html: string): string {
  // CSP precedes imported markup; source remains unchanged in storage/downloads.
  const policy = "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src https: data:; base-uri 'none'; form-action 'none'; connect-src 'none'";
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,base,form,meta[http-equiv="refresh"]').forEach(node => node.remove());
  doc.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attribute => {
    if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc') node.removeAttribute(attribute.name);
  }));
  const csp = doc.createElement('meta'); csp.httpEquiv = 'Content-Security-Policy'; csp.content = policy; doc.head.prepend(csp);
  return '<!doctype html>'+doc.documentElement.outerHTML;
}

export function savePayload(draft: EmailWorkspaceDraft, template: MessageTemplate | null): EmailWorkspaceDraft {
  return { ...draft, subject: template?.editable_subject != null && draft.subject === template.editable_subject ? template.subject ?? draft.subject : draft.subject };
}

export function validateWorkspaceDraft(draft: EmailWorkspaceDraft): string | null {
  if (!draft.name.trim()) return 'Enter a template name.';
  if (!draft.subject?.trim()) return 'Enter a subject line.';
  if (draft.editor_document_json.format === 'sections') {
    const sections = draft.editor_document_json.sections;
    if (!sections.length || !sections.some(section => section.heading.trim() || section.body.trim() || section.image_url.trim())) return 'Add some email content.';
    if (sections.some(section => section.type === 'image' && !/^https?:\/\//i.test(section.image_url))) return 'Add a complete image URL or remove the empty image section.';
    if (sections.some(section => section.type === 'button' && !/^(https?:\/\/|mailto:|tel:|\{\{[\w.]+\}\})/i.test(section.url))) return 'Add a valid link to each button.';
  } else if (!draft.body_html?.trim() && !draft.body_text?.trim()) return 'Add some email content.';
  return null;
}
