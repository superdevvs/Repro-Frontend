import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SmsComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  templates?: Array<{ id: string | number; name: string; body_text?: string }>;
  onSelectTemplate?: (body: string) => void;
  compact?: boolean;
}

export const SmsComposer = ({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = 'Write a message...',
  templates = [],
  onSelectTemplate,
  compact = false,
}: SmsComposerProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const characterCount = value.length;
  const segments = useMemo(() => {
    if (!characterCount) return 0;
    if (characterCount <= 160) return 1;
    return Math.ceil(characterCount / 153);
  }, [characterCount]);

  useEffect(() => {
    const field = inputRef.current;
    if (!field || !compact) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  }, [value, compact]);

  const templateMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={compact ? 'h-11 w-11 text-muted-foreground' : 'text-muted-foreground'}
          type="button"
          disabled={!templates.length}
          aria-label="Insert template"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {templates.length === 0 && <DropdownMenuItem disabled>No templates</DropdownMenuItem>}
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => {
              if (template.body_text) {
                onSelectTemplate?.(template.body_text);
              }
            }}
          >
            {template.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (compact) {
    return (
      <div className="shrink-0 border-t border-border/70 bg-background px-2 py-2">
        {characterCount > 0 && (
          <p className="px-12 pb-1 text-right text-[11px] text-muted-foreground">
            {characterCount} chars · {segments} {segments === 1 ? 'segment' : 'segments'}
          </p>
        )}
        <div className="flex items-end gap-1">
          {templateMenu}
          <Textarea
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={1}
            placeholder={placeholder}
            className="max-h-32 min-h-11 flex-1 resize-none py-2.5"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!disabled) onSend();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            onClick={onSend}
            disabled={disabled}
            aria-label="Send message"
            className="h-11 w-11 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border/70 bg-background/80 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button variant="ghost" size="icon" className="text-muted-foreground" type="button">
          <Paperclip className="h-4 w-4" />
        </Button>
        {templateMenu}
        <span className="ml-auto">
          {characterCount} chars • {segments} segments
        </span>
      </div>
      <div className="flex items-end gap-3">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          placeholder={placeholder}
          className="min-h-[76px] flex-1 resize-none"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!disabled) {
                onSend();
              }
            }
          }}
        />
        <Button size="lg" onClick={onSend} disabled={disabled}>
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
};
