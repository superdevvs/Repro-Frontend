import type { EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import { flattenEmailSections } from './emailWorkspaceTree';

export function EmailWorkspacePreflight({ draft }: { draft: EmailWorkspaceDraft }) {
  const sections = flattenEmailSections(draft.editor_document_json.sections);
  const warnings: string[] = [];
  if (!draft.subject?.trim()) warnings.push('Add your subject line.');
  if (!draft.editor_document_json.preheader?.trim()) warnings.push('Add inbox preview text for a stronger first impression.');
  if (sections.some(item => item.type === 'button' && !item.url)) warnings.push('Complete each button’s destination.');
  if (sections.some(item => item.type === 'video' && !item.image_url)) warnings.push('Add a thumbnail to each video. Its text link will still be available.');
  if (sections.some(item => item.type === 'video' && !item.video_url)) warnings.push('Complete each video link.');
  if (sections.some(item => /add your|add the actual|your first benefit|your second benefit|package name/i.test(item.heading+' '+item.body))) warnings.push('Replace the starter wording with your actual details.');
  const variables = [...new Set((JSON.stringify(draft).match(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g) ?? []))];
  return <div className="ews-preflight"><strong>Before you send</strong>{warnings.length ? <ul>{warnings.map(text => <li key={text}>{text}</li>)}</ul> : <p>Your content fields are complete. Review the final preview before sending.</p>}{variables.length > 0 && <p className="ews-help">Connected fields need matching recipient/context data: {variables.join(', ')}</p>}<p className="ews-help">Check desktop and mobile preview, then send yourself a test. Required provider footers remain part of delivery.</p></div>;
}
