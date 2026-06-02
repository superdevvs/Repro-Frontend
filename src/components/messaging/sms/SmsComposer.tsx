import { useMemo } from 'react';
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
}

export const SmsComposer = ({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = 'Write a message...',
  templates = [],
  onSelectTemplate,
}: SmsComposerProps) => {
  const characterCount = value.length;
  const segments = useMemo(() => {
    if (!characterCount) return 0;
    if (characterCount <= 160) return 1;
    return Math.ceil(characterCount / 153);
  }, [characterCount]);

  return (
    <div className="space-y-3 border-t border-border/70 bg-background/80 p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button variant="ghost" size="icon" className="text-muted-foreground" type="button">
          <Paperclip className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground" type="button" disabled={!templates.length}>
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
        <span className="ml-auto">
          {characterCount} chars • {segments} segments
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
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
        <Button size="lg" onClick={onSend} disabled={disabled} className="w-full sm:w-auto">
          <Send className="mr-2 h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
};
