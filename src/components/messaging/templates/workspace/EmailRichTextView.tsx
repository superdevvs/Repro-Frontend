import { Fragment, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/core';

export function EmailRichTextView({ node }: { node: JSONContent }) {
  function content(current: JSONContent, key: number): ReactNode {
    if (current.type === 'text') {
      let value: ReactNode = current.text ?? '';
      for (const mark of current.marks ?? []) {
        if (mark.type === 'bold') value = <strong>{value}</strong>;
        if (mark.type === 'italic') value = <em>{value}</em>;
        if (mark.type === 'underline') value = <u>{value}</u>;
        if (mark.type === 'link') value = <span className="ews-inline-link">{value}</span>;
        if (mark.type === 'textStyle' && /^#[a-f0-9]{6}$/i.test(mark.attrs?.color ?? '')) value = <span style={{ color: mark.attrs!.color }}>{value}</span>;
      }
      return <Fragment key={key}>{value}</Fragment>;
    }
    const children = current.content?.map(content);
    if (current.type === 'hardBreak') return <br key={key}/>;
    if (current.type === 'bulletList') return <ul key={key}>{children}</ul>;
    if (current.type === 'orderedList') return <ol key={key}>{children}</ol>;
    if (current.type === 'listItem') return <li key={key}>{children}</li>;
    if (current.type === 'heading') return <h3 key={key}>{children}</h3>;
    if (current.type === 'paragraph') return <p key={key} style={{ textAlign: ['left','right','center'].includes(current.attrs?.textAlign) ? current.attrs!.textAlign : undefined }}>{children}</p>;
    return <Fragment key={key}>{children}</Fragment>;
  }
  return <div className="ews-rich-view">{content(node, 0)}</div>;
}
