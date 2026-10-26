import type { EmailTemplateSection, EmailWorkspaceDraft } from '@/types/emailTemplateWorkspace';
import { newSection, startingEmail } from './emailWorkspaceModel';

export const emailSectionTypes = {
  hero: 'Headline + hero', feature: 'Image + text', text: 'Text & heading', columns: 'Columns / cards', video: 'Video thumbnail',
  steps: 'Numbered steps', details: 'Details / comparison', tips: 'Bullet list', notice: 'Callout', quote: 'Testimonial / quote',
  offer: 'Offer banner', faq: 'Question & answer', signature: 'Contact / signature', image: 'Image / gallery tile', button: 'Button', divider: 'Divider', spacer: 'Spacer',
} satisfies Record<EmailTemplateSection['type'], string>;

const block = (type: EmailTemplateSection['type'], heading = '', body = '') => ({ ...newSection(type), ...(type === 'feature' ? { layout: 'stacked' as const, image_width: 120 } : {}), heading, body });
export const emailSectionPatterns = [
  ['benefits','Three benefit cards'], ['packages','Package / pricing cards'], ['gallery','Photo gallery'], ['before-after','Before & after'], ['comparison','Service comparison'], ['faq','Question & answer'], ['social','Website & social links'],
] as const;
export function emailSectionPattern(id: string): EmailTemplateSection {
  if (id === 'faq') return block('faq', 'Your client’s question', 'Add a clear, helpful answer.');
  if (id === 'social') return block('text', 'Stay connected', '[Visit our website](https://reprodashboard.com)\n\nAdd your actual social profile links here.');
  const columns = id === 'benefits' || id === 'gallery' ? 3 : 2;
  return { ...block('columns'), columns: Array.from({ length: columns }, (_, i) => {
    if (id === 'gallery') return [{ ...block('image'), caption: 'Add a photograph and caption' }];
    if (id === 'before-after') return [{ ...block('image'), caption: i === 0 ? 'Before' : 'After' }];
    if (id === 'packages') return [block('offer', 'Package name', 'Add your approved price.'), block('tips', 'What’s included', 'Add the actual inclusions.\nExplain who this package is for.'), block('button', 'Choose this package')];
    if (id === 'comparison') return [block('details', i === 0 ? 'Option one' : 'Option two', 'Feature | Add the actual detail\nBest for | Describe the audience')];
    return [block('feature', `Benefit ${i + 1}`, 'Explain the benefit in one or two sentences.')];
  }) };
}
export const emailPresets = [
  { id: 'sales', name: 'Sales & services', description: 'A strong opening, benefits, service cards and a clear next step.' },
  { id: 'offer', name: 'Offer & packages', description: 'Package cards, inclusions, supplied prices and offer terms.' },
  { id: 'portfolio', name: 'Property & portfolio', description: 'Photography, a gallery, video and booking action.' },
  { id: 'newsletter', name: 'Newsletter', description: 'A lead story, articles and useful updates.' },
  { id: 'announcement', name: 'New service / announcement', description: 'A clear introduction and visual feature rows.' },
  { id: 'onboarding', name: 'Client onboarding', description: 'A welcome, explainer video and next steps.' },
  { id: 'guide', name: 'Photographer guide', description: 'Numbered instructions, examples and resources.' },
  { id: 'followup', name: 'Event follow-up', description: 'A personal thank-you, supplied offer and next action.' },
  { id: 'letter', name: 'Personal message', description: 'A simple, thoughtful letter with your signature.' },
] as const;

export function emailPreset(id: string): EmailWorkspaceDraft {
  const draft = startingEmail('blank');
  const preset = emailPresets.find(item => item.id === id) ?? emailPresets[0];
  draft.name = preset.name; draft.subject = ''; draft.editor_document_json.version = 2;
  const hero = block('hero', id === 'letter' ? 'Hello,' : 'Your next great listing starts here.', 'Add your introduction, or ask Robbie to write it.');
  hero.eyebrow = id === 'letter' ? '' : 'R/E PRO PHOTOS';
  const signature = block('signature', 'The R/E Pro Photos team', 'Have a question? Reply to this email and we’ll help.');
  const action = block('button', 'Choose your next step');
  const cards = { ...block('columns'), columns: [
    [block('feature', 'Your first benefit', 'Explain what this means for your client.')],
    [block('feature', 'Your second benefit', 'Give one clear reason to choose your service.')],
  ] };
  let sections: EmailTemplateSection[];
  switch (id) {
    case 'letter': sections = [hero, block('text', '', 'Write your personal message here.'), signature]; break;
    case 'offer': sections = [hero, block('offer', 'Your offer', 'Add your approved offer and eligibility here.'), cards, block('notice', 'Offer details', 'Add the actual terms and any deadline.'), action, signature]; break;
    case 'portfolio': sections = [hero, { ...cards, columns: [[block('image')], [block('image')]] }, block('video', 'Take a closer look'), action, signature]; break;
    case 'newsletter': sections = [hero, block('feature', 'The lead story', 'Share your most useful update.'), cards, action, signature]; break;
    case 'onboarding': sections = [hero, block('video', 'A quick introduction'), block('steps', 'Getting started', 'Add the first step.\nAdd the next step.\nExplain where to get help.'), action, signature]; break;
    case 'guide': sections = [hero, block('steps', 'What to do', 'Add the exact dashboard navigation.\nExplain what to review.\nDescribe the final action.'), block('notice', 'Keep in mind', 'Add a practical reminder.'), action, signature]; break;
    case 'followup': sections = [hero, block('text', 'Thank you for connecting', 'Add your conversation details.'), block('offer', 'A little thank-you', 'Add your actual follow-up offer.'), action, signature]; break;
    default: sections = [hero, cards, block('feature', 'Designed around your next listing', 'Show how your service helps.'), action, signature];
  }
  draft.editor_document_json.sections = sections;
  return draft;
}
