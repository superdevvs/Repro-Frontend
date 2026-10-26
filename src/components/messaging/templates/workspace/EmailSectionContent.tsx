import { lazy, Suspense, Fragment, type ReactNode, type CSSProperties } from 'react';
import type { EmailTemplateSection } from '@/types/emailTemplateWorkspace';
import { artworkLabel, artworkRatio, type EmailArtworkState } from './emailArtworkPreview';

import { EmailRichTextView } from './EmailRichTextView';
const RichText = lazy(() => import('./EmailRichText').then(module => ({ default: module.EmailRichText })));

/** A small, inert inline preview: text never becomes executable HTML. */
export function EmailInlineText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let previous = 0;
  for (const match of text.matchAll(pattern)) {
    nodes.push(text.slice(previous, match.index));
    nodes.push(match[1] ? <strong key={match.index}>{match[1]}</strong> : match[2] ? <em key={match.index}>{match[2]}</em> : <span key={match.index} className="ews-inline-link" title={match[4]}>{match[3]}</span>);
    previous = match.index! + match[0].length;
  }
  nodes.push(text.slice(previous));
  return <>{nodes}</>;
}

export function EmailSectionContent({ section, artwork, onChange, disabled = false }: { section: EmailTemplateSection; artwork?: EmailArtworkState; onChange?: (patch: Partial<EmailTemplateSection>) => void; disabled?: boolean }) {
  const url = artwork?.status === 'ready' ? artwork.url ?? section.image_url : section.image_url;
  const hasImage = /^https?:\/\//i.test(url);
  const loading = artwork?.status === 'loading';
  const hasSlot = hasImage || Boolean(artwork);
  const image = loading || (artwork?.status === 'failed' && !hasImage)
    ? <div className="ews-artwork-loading" role="status" aria-label={`${artwork.label ?? artworkLabel(artwork.kind)}: ${section.alt || section.heading}`} style={{ aspectRatio: artwork.ratio ?? artworkRatio(artwork.kind) }}><span className="ews-artwork-indicator" aria-hidden="true">{loading ? '◌' : '◇'}</span><span>{loading ? (artwork.label ?? artworkLabel(artwork.kind))+'…' : 'Image could not be created'}</span></div>
    : hasImage ? <img className="ews-section-image" src={url} alt={section.alt} referrerPolicy="no-referrer" style={{ objectFit: section.styles?.fit, borderRadius: section.styles?.radius, ...(section.styles?.aspect && section.styles.aspect !== 'auto' ? { aspectRatio: section.styles.aspect.replace(':', ' / '), width: '100%' } : {}) }}/> : <div className="ews-image-placeholder">Add an image or generate one with Robbie</div>;
  const lines = section.body.split('\n').filter(line => line.trim());
  const copy = <>
    {section.eyebrow && <span className="ews-section-eyebrow">{section.eyebrow}</span>}
    {onChange && !['button','image','divider','spacer'].includes(section.type) ? <textarea rows={section.type === 'hero' ? 2 : 1} maxLength={500} className={'ews-inline-heading '+(section.type === 'hero' ? 'ews-inline-title' : '')} aria-label="Inline heading" value={section.heading} disabled={disabled} placeholder="Add a heading…" onChange={event => onChange({ heading: event.target.value })}/> : section.heading && (section.type === 'hero' ? <h1>{section.heading}</h1> : <h2>{section.heading}</h2>)}
    {onChange && ['text','hero','feature','notice','quote','offer','signature','faq'].includes(section.type) ? <Suspense fallback={<p>{section.body}</p>}><RichText section={section} disabled={disabled} onChange={onChange}/></Suspense> : section.rich_text ? <EmailRichTextView node={section.rich_text}/> : section.type === 'tips' ? <ul>{lines.map((line, i) => <li key={i}><EmailInlineText text={line}/></li>)}</ul>
      : section.type === 'steps' ? <ol className="ews-numbered-steps">{lines.map((line, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span><div><EmailInlineText text={line}/></div></li>)}</ol>
      : section.type === 'details' ? <dl className="ews-detail-rows">{lines.map((line, i) => { const [label, ...value] = line.split('|'); return <Fragment key={i}><dt>{label.trim()}</dt><dd><EmailInlineText text={value.join('|').trim()}/></dd></Fragment>; })}</dl>
      : <div className="ews-section-paragraphs">{(section.body || (!section.heading ? 'Click to write your message…' : '')).split(/\n\s*\n/).map((paragraph, i) => <p key={i} style={{ fontSize: section.styles?.font_size, color: section.styles?.color }}><EmailInlineText text={paragraph}/></p>)}</div>}
  </>;
  if (section.type === 'image') return <>{image}{section.caption && <small>{section.caption}</small>}</>;
  if (section.type === 'spacer') return <div className="ews-spacer-preview" style={{ height: section.spacing }}>Spacer</div>;
  if (section.type === 'video') return <div className="ews-video-preview">{copy}<div>{image}{!section.media_id && <span aria-hidden="true" className="ews-video-play">▶</span>}</div><span className="ews-inline-link">Watch video{section.duration ? ' · '+section.duration : ''}</span></div>;
  if (section.type === 'divider') return <hr/>;
  if (section.type === 'button') return <span className="ews-email-button">{section.heading || 'Button label'}</span>;
  return <div className={'ews-section-design ews-section-'+section.type} data-tone={section.type === 'offer' ? 'accent' : section.type === 'quote' ? 'soft' : section.tone ?? (section.type === 'notice' ? 'soft' : 'plain')} style={{ background: section.styles?.background, color: section.styles?.color, fontSize: section.styles?.font_size, padding: section.styles?.padding, borderRadius: section.styles?.radius }}>
    {section.type === 'feature' && hasSlot ? <div className="ews-feature" data-layout={section.layout ?? 'image-left'} style={{ '--ews-image-width': (section.image_width ?? 160)+'px' } as CSSProperties}><div className="ews-feature-image">{image}</div><div className="ews-feature-copy">{copy}</div></div>
      : <>{copy}{section.type === 'hero' && hasSlot && <div className="ews-hero-image">{image}</div>}</>}
  </div>;
}
