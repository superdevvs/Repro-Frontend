import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { isSafeSupportLink } from '@/services/supportKnowledge';

/** Render the small markdown subset emitted by Robbie without interpreting HTML. */
export function ChatText({ content }: { content: string }) {
  return <>{content.split(/(\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).map((token, index) => {
    const link = token.match(/^\[([^\]\n]+)\]\(([^\s)]+)\)$/);
    if (link && isSafeSupportLink(link[2])) {
      const className = 'font-medium underline underline-offset-4 hover:opacity-80';
      return link[2].startsWith('/')
        ? <Link key={index} className={className} to={link[2]}>{link[1]}</Link>
        : <a key={index} className={className} href={link[2]}>{link[1]}</a>;
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return <strong key={index} className="font-semibold">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return <code key={index} className="rounded bg-black/5 px-1 py-0.5 text-[0.85em] dark:bg-white/10">{token.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{token}</Fragment>;
  })}</>;
}
