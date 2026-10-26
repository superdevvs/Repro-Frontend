import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import TextAlign from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Button } from '@/components/ui/button';
import type { EmailTemplateSection } from '@/types/emailTemplateWorkspace';

export function EmailRichText({ section, disabled, onChange }: { section: EmailTemplateSection; disabled: boolean; onChange: (patch: Partial<EmailTemplateSection>) => void }) {
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false), [link, setLink] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ undoRedo: false, codeBlock: false, code: false, horizontalRule: false, heading: { levels: [2, 3, 4] }, link: { openOnClick: false, isAllowedUri: (url, context) => /^\{\{\s*[a-z_][a-z0-9_.]*\s*\}\}$/i.test(url) || context.defaultValidate(url) } }), Markdown, TextAlign.configure({ types: ['heading','paragraph'] }), TextStyle, Color],
    content: section.rich_text ?? section.body, contentType: section.rich_text ? 'json' : 'markdown', editable: !disabled,
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Rich email text', class: 'ews-rich-editor' } },
    onUpdate: ({ editor: current }) => onChangeRef.current({ body: current.getMarkdown().replace(/%7B%7B([a-z_][a-z0-9_.]*)%7D%7D/gi, '{{$1}}'), rich_text: current.getJSON() }),
  }, [section.id]);
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled, false);
    const changed = section.rich_text ? JSON.stringify(editor.getJSON()) !== JSON.stringify(section.rich_text) : editor.getMarkdown() !== section.body;
    if (changed) editor.commands.setContent(section.rich_text ?? section.body, { emitUpdate: false, contentType: section.rich_text ? 'json' : 'markdown' });
  }, [editor, section.rich_text, section.body, disabled]);
  useEffect(() => {
    const insert = (event: Event) => { const detail = (event as CustomEvent<{ id: string; value: string }>).detail; if (editor && detail.id === section.id) editor.chain().focus().insertContent({ type: 'text', text: detail.value }).run(); };
    window.addEventListener('email-workspace-insert-field', insert); return () => window.removeEventListener('email-workspace-insert-field', insert);
  }, [editor, section.id]);
  if (!editor) return null;
  const commands = [
    ['Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
    ['Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
    ['Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline')],
    ['Bullets', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
    ['Numbered list', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
    ['Align left', () => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' })],
    ['Align center', () => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' })],
    ['Clear formatting', () => editor.chain().focus().unsetAllMarks().clearNodes().run(), false],
  ] as const;
  return <div className="ews-rich-text" onFocusCapture={() => window.dispatchEvent(new CustomEvent('email-workspace-rich-focus', { detail: section.id }))} onClick={event => event.stopPropagation()}>
    <div role="toolbar" aria-label="Rich text formatting" className="ews-rich-toolbar">
      {commands.map(([label, action, pressed]) => <Button key={label} type="button" size="sm" variant="ghost" disabled={disabled} aria-pressed={pressed} onMouseDown={event => event.preventDefault()} onClick={action}>{label}</Button>)}
      <select aria-label="Text heading style" disabled={disabled} value={editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : '0'} onChange={event => { const level = Number(event.target.value); if (level) editor.chain().focus().setHeading({ level: level as 2 | 3 }).run(); else editor.chain().focus().setParagraph().run(); }}><option value="0">Paragraph</option><option value="2">Heading</option><option value="3">Subheading</option></select>
      <input type="color" aria-label="Text color" disabled={disabled} value={editor.getAttributes('textStyle').color || '#195fe6'} onChange={event => editor.chain().focus().setColor(event.target.value).run()}/>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => { setLink(editor.getAttributes('link').href ?? 'https://'); setLinkOpen(!linkOpen); }}>Link</Button>
    </div>
    {linkOpen && <div className="ews-link-editor"><input aria-label="Text link URL" value={link} onChange={event => setLink(event.target.value)} placeholder="https://…"/><Button size="sm" disabled={!/^(https?:\/\/|mailto:|tel:|\{\{)/i.test(link)} onClick={() => { editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run(); setLinkOpen(false); }}>Apply link</Button><Button size="sm" variant="ghost" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Remove link</Button></div>}
    <EditorContent editor={editor}/>
  </div>;
}
