import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SmsAttachmentTray } from './SmsAttachmentTray';
import type { DraftAttachment } from './useSmsAttachmentDrafts';

interface SmsComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  templates?: Array<{ id: string | number; name: string; body_text?: string }>;
  onSelectTemplate?: (body: string) => void;
  compact?: boolean;
  senderControl?: ReactNode;
  /** Attaching is offered only when a handler is provided. */
  attachments?: DraftAttachment[];
  onAttachFiles?: (files: File[]) => void;
  onRemoveAttachment?: (key: string) => void;
  onRetryAttachment?: (key: string) => void;
  attachDisabled?: boolean;
  /** Shown on the disabled attach button when attaching is not possible at all. */
  attachUnavailableReason?: string;
  attachmentNotice?: string[];
}

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

export const SmsComposer = ({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = 'Write a message...',
  templates = [],
  onSelectTemplate,
  compact = false,
  senderControl,
  attachments = [],
  onAttachFiles,
  onRemoveAttachment,
  onRetryAttachment,
  attachDisabled,
  attachUnavailableReason,
  attachmentNotice = [],
}: SmsComposerProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const canAttach = Boolean(onAttachFiles) && !attachDisabled && !attachUnavailableReason;
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

  const counter = `${characterCount} chars · ${segments} ${segments === 1 ? 'segment' : 'segments'}${attachments.length > 0 ? ' + attachment link' : ''}`;

  const attach = (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files ?? []);
    if (list.length > 0 && canAttach) onAttachFiles?.(list);
  };
  const dropTarget = onAttachFiles ? {
    onDragOver: (event: DragEvent) => { if (hasFiles(event)) { event.preventDefault(); if (canAttach) setDropping(true); } },
    onDragLeave: (event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false); },
    onDrop: (event: DragEvent) => { if (hasFiles(event)) { event.preventDefault(); setDropping(false); attach(event.dataTransfer.files); } },
  } : {};
  const pasteFiles = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0 || !canAttach) return;
    event.preventDefault();
    attach(files);
  };

  const attachButton = onAttachFiles ? (
    <>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={!canAttach}
        onChange={(event) => { attach(event.target.files); event.target.value = ''; }}
        data-testid="sms-attachment-input"
      />
      <Button
        variant="ghost"
        size="icon"
        className={compact ? 'h-11 w-11 shrink-0 text-muted-foreground' : 'h-8 w-8 shrink-0 text-muted-foreground'}
        type="button"
        aria-label="Attach photos or files"
        title={attachUnavailableReason ?? 'Attach photos or files'}
        disabled={!canAttach}
        onClick={() => fileRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    </>
  ) : null;

  const tray = (attachments.length > 0 || attachmentNotice.length > 0) ? (
    <div className="space-y-1.5">
      {attachmentNotice.length > 0 && (
        <ul role="alert" className="space-y-0.5 text-xs text-destructive">
          {attachmentNotice.map(notice => <li key={notice}>{notice}</li>)}
        </ul>
      )}
      <SmsAttachmentTray
        items={attachments}
        onRemove={(key) => onRemoveAttachment?.(key)}
        onRetry={(key) => onRetryAttachment?.(key)}
        disabled={attachDisabled}
      />
    </div>
  ) : null;

  const templateMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={compact ? 'h-11 w-11 text-muted-foreground' : 'h-8 w-8 shrink-0 text-muted-foreground'}
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
      <div
        {...dropTarget}
        className={cn('shrink-0 border-t border-border/70 bg-background px-2 py-2', dropping && 'ring-2 ring-inset ring-primary/60')}
      >
        {senderControl && <div className="mb-2 px-1">{senderControl}</div>}
        {tray && <div className="mb-2 px-1">{tray}</div>}
        {characterCount > 0 && (
          <p className="px-12 pb-1 text-right text-[11px] text-muted-foreground">
            {counter}
          </p>
        )}
        <div className="flex items-end gap-1">
          {attachButton}
          {templateMenu}
          <Textarea
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={1}
            placeholder={placeholder}
            className="max-h-32 min-h-11 flex-1 resize-none py-2.5"
            onPaste={pasteFiles}
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
    <div
      {...dropTarget}
      className={cn('relative space-y-3 border-t border-border/70 bg-background/80 p-4', dropping && 'ring-2 ring-inset ring-primary/60')}
    >
      {dropping && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/85 text-sm font-medium text-foreground">
          Drop photos or files to attach
        </div>
      )}
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {attachButton}
        {templateMenu}
        {senderControl && <div className="min-w-0 max-w-sm flex-1 [&>div]:grid-cols-[auto_minmax(0,1fr)] [&>div]:gap-x-2">{senderControl}</div>}
        <span className="ml-auto shrink-0 whitespace-nowrap pl-1 text-[10px]">
          {counter}
        </span>
      </div>
      {tray}
      <div className="flex items-end gap-3">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          placeholder={placeholder}
          className="min-h-[76px] flex-1 resize-none"
          onPaste={pasteFiles}
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
