import { Fragment, type ReactNode, type CSSProperties } from 'react';
import type { EmailTemplateSection } from '@/types/emailTemplateWorkspace';

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

export function EmailSectionContent({ section }: { section: EmailTemplateSection }) {
  const hasImage = /^https?:\/\//i.test(section.image_url);
  const image = hasImage ? <img className="ews-section-image" src={section.image_url} alt={section.alt} referrerPolicy="no-referrer"/> : <div className="ews-image-placeholder">Add an image or generate one with Robbie</div>;
  const lines = section.body.split('\n').filter(line => line.trim());
  const copy = <>
    {section.eyebrow && <span className="ews-section-eyebrow">{section.eyebrow}</span>}
    {section.heading && (section.type === 'hero' ? <h1>{section.heading}</h1> : <h2>{section.heading}</h2>)}
    {section.type === 'tips' ? <ul>{lines.map((line, i) => <li key={i}><EmailInlineText text={line}/></li>)}</ul>
      : section.type === 'steps' ? <ol className="ews-numbered-steps">{lines.map((line, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span><div><EmailInlineText text={line}/></div></li>)}</ol>
      : section.type === 'details' ? <dl className="ews-detail-rows">{lines.map((line, i) => { const [label, ...value] = line.split('|'); return <Fragment key={i}><dt>{label.trim()}</dt><dd><EmailInlineText text={value.join('|').trim()}/></dd></Fragment>; })}</dl>
      : <div className="ews-section-paragraphs">{(section.body || (!section.heading ? 'Click to write your message…' : '')).split(/\n\s*\n/).map((paragraph, i) => <p key={i}><EmailInlineText text={paragraph}/></p>)}</div>}
  </>;
  if (section.type === 'image') return image;
  if (section.type === 'divider') return <hr/>;
  if (section.type === 'button') return <span className="ews-email-button">{section.heading || 'Button label'}</span>;
  return <div className={'ews-section-design ews-section-'+section.type} data-tone={section.tone ?? (section.type === 'notice' ? 'soft' : 'plain')}>
    {section.type === 'feature' && hasImage ? <div className="ews-feature" data-layout={section.layout ?? 'image-left'} style={{ '--ews-image-width': (section.image_width ?? 160)+'px' } as CSSProperties}><div className="ews-feature-image">{image}</div><div className="ews-feature-copy">{copy}</div></div>
      : <>{copy}{section.type === 'hero' && hasImage && <div className="ews-hero-image">{image}</div>}</>}
  </div>;
}
