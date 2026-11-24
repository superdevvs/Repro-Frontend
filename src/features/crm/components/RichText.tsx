import React, { useEffect, useRef } from 'react';
import { Bold, Italic, List, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A small editor for email bodies: paragraphs, bold, italic, lists and links.
 * The server sanitises to the same allow-list before rendering or sending.
 */
export function RichText({ value, onChange, label, className, minHeight = 180 }: { value: string; onChange: (html: string) => void; label: string; className?: string; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);

  useEffect(() => {
    if (ref.current && value !== last.current) {
      ref.current.innerHTML = value;
      last.current = value;
    }
  }, [value]);
  useEffect(() => { if (ref.current) ref.current.innerHTML = value; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = () => {
    const html = ref.current?.innerHTML ?? '';
    last.current = html;
    onChange(html);
  };
  const cmd = (name: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-background focus-within:ring-2 focus-within:ring-primary/25', className)}>
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1" role="toolbar" aria-label="Formatting">
        <ToolButton label="Bold" onClick={() => cmd('bold')}><Bold className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton label="Italic" onClick={() => cmd('italic')}><Italic className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton label="Bulleted list" onClick={() => cmd('insertUnorderedList')}><List className="h-3.5 w-3.5" /></ToolButton>
        <ToolButton label="Link" onClick={() => { const url = window.prompt('Link address (https://…)'); if (url && /^https?:\/\//i.test(url)) cmd('createLink', url); }}><LinkIcon className="h-3.5 w-3.5" /></ToolButton>
        <span className="ml-auto pr-1 text-[11px] text-muted-foreground">Merge fields like {'{{first_name}}'} are filled in when sent.</span>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="prose-sm max-w-none px-3 py-2.5 text-[13.5px] leading-[22px] outline-none [&_a]:text-primary [&_a]:underline [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        style={{ minHeight }}
      />
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
      {children}
    </button>
  );
}

/** Rendered email in a sandboxed frame, so its styles never leak into the app. */
export function EmailFrame({ html, title, className, height = 520 }: { html: string; title: string; className?: string; height?: number }) {
  return <iframe title={title} sandbox="" srcDoc={html} className={cn('crm-email-frame w-full border-0', className)} style={{ height }} />;
}
