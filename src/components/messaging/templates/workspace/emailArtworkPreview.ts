import type { TemplateDraft } from '@/services/messaging';
import type { EmailArtworkKind } from '@/types/emailTemplateWorkspace';

export type EmailArtworkState = { status: 'loading' | 'ready' | 'failed'; kind: EmailArtworkKind; url?: string };
export type EmailArtworkStates = Record<string, EmailArtworkState>;

export const artworkLabel = (kind: EmailArtworkKind) => kind === 'header' ? 'Creating wide header' : kind === 'icon' ? 'Creating icon' : 'Creating illustration';
export const artworkRatio = (kind: EmailArtworkKind) => kind === 'header' ? '12 / 5' : kind === 'icon' ? '1' : '3 / 2';

/** Only the preview request uses a stable image source. Generated URLs are patched
 * into the rendered slots locally, without another server render per image. */
export function artworkRenderDraft(draft: TemplateDraft, artwork: EmailArtworkStates): TemplateDraft {
  const document = draft.editor_document_json;
  if (document?.format !== 'sections') return draft;
  return { ...draft, editor_document_json: { ...document, sections: document.sections.map(section =>
    section.artwork_id && artwork[section.artwork_id]
      ? { ...section, image_url: 'https://reprodashboard.com/images/email-atelier/v6/welcome.png' }
      : section,
  ) } };
}

/** Preview-only placeholders never enter the saved or sent email HTML. Section
 * IDs supplied by the server keep identical image URLs in different slots safe. */
export function emailArtworkPreview(html: string, draft: TemplateDraft, artwork: EmailArtworkStates, theme: 'light' | 'dark'): string {
  if (draft.editor_document_json?.format !== 'sections' || !Object.keys(artwork).length) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const section of draft.editor_document_json.sections) {
    const state = section.artwork_id ? artwork[section.artwork_id] : undefined;
    if (!state) continue;
    const wrapper = [...doc.querySelectorAll('[data-email-section]')].find(node => node.getAttribute('data-email-section') === section.id);
    const image = wrapper?.querySelector('img');
    if (!image) continue;
    if (state.status === 'ready' || (state.status === 'failed' && /^https?:\/\//i.test(section.image_url))) {
      image.setAttribute('src', state.url ?? section.image_url);
      continue;
    }
    const placeholder = doc.createElement('div');
    placeholder.setAttribute('role', 'status');
    placeholder.setAttribute('aria-label', `${artworkLabel(state.kind)}: ${section.alt || section.heading}`);
    placeholder.setAttribute('data-artwork-loading', section.artwork_id!);
    placeholder.style.cssText = `box-sizing:border-box;width:100%;aspect-ratio:${artworkRatio(state.kind)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;border:1px dashed ${theme === 'dark' ? '#35506e' : '#b9cee9'};border-radius:12px;background:${theme === 'dark' ? '#102438' : '#f0f6ff'};color:${theme === 'dark' ? '#a9c9ff' : '#32609c'};font:13px/1.5 Arial,sans-serif;text-align:center;`;
    const indicator = doc.createElement('span');
    indicator.textContent = state.status === 'loading' ? '◌' : '◇';
    indicator.style.cssText = 'font-size:28px;line-height:1;';
    const label = doc.createElement('span');
    label.textContent = state.status === 'loading' ? `${artworkLabel(state.kind)}…` : 'Image could not be created';
    placeholder.append(indicator, label);
    image.replaceWith(placeholder);
  }
  return '<!doctype html>'+doc.documentElement.outerHTML;
}
