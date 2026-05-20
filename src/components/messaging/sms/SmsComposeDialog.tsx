import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Sparkles } from 'lucide-react';

interface SmsComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (payload: { to: string; bodyText: string }) => void;
  sending?: boolean;
  templates?: Array<{ id: string | number; name: string; body_text?: string }>;
}

export const SmsComposeDialog = ({
  open,
  onOpenChange,
  onSend,
  sending,
  templates = [],
}: SmsComposeDialogProps) => {
  const [to, setTo] = useState('');
  const [bodyText, setBodyText] = useState('');

  const characterCount = bodyText.length;
  const segments = useMemo(() => {
    if (!characterCount) return 0;
    if (characterCount <= 160) return 1;
    return Math.ceil(characterCount / 153);
  }, [characterCount]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (sending) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTo('');
      setBodyText('');
    }
  };

  const handleSend = () => {
    if (!to.trim() || !bodyText.trim()) return;
    onSend({ to: to.trim(), bodyText: bodyText.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New SMS</DialogTitle>
          <DialogDescription>Start a conversation with a phone number.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sms-compose-to">To</Label>
            <Input
              id="sms-compose-to"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="Phone number"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="sms-compose-body">Message</Label>
              <span className="text-xs text-muted-foreground">
                {characterCount} chars • {segments} segments
              </span>
            </div>
            <Textarea
              id="sms-compose-body"
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={5}
              placeholder="Write a message..."
              className="resize-none"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" type="button" disabled={!templates.length || sending}>
                <Sparkles className="mr-2 h-4 w-4" />
                Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {templates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => {
                    if (template.body_text) {
                      setBodyText(template.body_text);
                    }
                  }}
                >
                  {template.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !to.trim() || !bodyText.trim()}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
