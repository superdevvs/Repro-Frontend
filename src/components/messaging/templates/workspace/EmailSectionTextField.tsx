import { useRef } from 'react';
import { Bold, Italic, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/sonner-toast';

export function EmailSectionTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  function format(type: 'bold' | 'italic' | 'link') {
    const field = input.current; if (!field) return;
    const start = field.selectionStart, end = field.selectionEnd;
    const selected = value.slice(start, end) || (type === 'link' ? 'Link text' : 'Your text');
    let text = type === 'bold' ? '**'+selected+'**' : '*'+selected+'*';
    if (type === 'link') {
      const url = window.prompt('Link URL', 'https://');
      if (url === null) return;
      if (!/^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d()-]+)$/i.test(url)) { toast.error('Enter a complete https://, email or phone link.'); return; }
      text = '['+selected+']('+url+')';
    }
    onChange(value.slice(0, start)+text+value.slice(end));
    window.setTimeout(() => { field.focus(); field.setSelectionRange(start, start+text.length); }, 0);
  }
  return <div className="ews-format-field"><label>{label}<Textarea ref={input} rows={8} value={value} onChange={event => onChange(event.target.value)}/></label><div className="ews-format-toolbar" role="group" aria-label="Text formatting">
    <Button variant="ghost" size="icon" aria-label="Bold text" title="Bold" onMouseDown={event => event.preventDefault()} onClick={() => format('bold')}><Bold size={16}/></Button>
    <Button variant="ghost" size="icon" aria-label="Italic text" title="Italic" onMouseDown={event => event.preventDefault()} onClick={() => format('italic')}><Italic size={16}/></Button>
    <Button variant="ghost" size="icon" aria-label="Add text link" title="Link" onMouseDown={event => event.preventDefault()} onClick={() => format('link')}><Link2 size={16}/></Button>
    <span>Select text to format</span>
  </div></div>;
}
