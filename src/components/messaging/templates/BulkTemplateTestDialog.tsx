import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

import type { MessageTemplate } from '@/types/messaging';
import { testSendTemplate } from '@/services/messaging';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getStoredTemplateTestEmail, setStoredTemplateTestEmail } from './testSendStorage';

interface BulkTemplateTestDialogProps {
  open: boolean;
  templates: MessageTemplate[];
  onClose: () => void;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message;
  }

  return fallback;
};

export function BulkTemplateTestDialog({ open, templates, onClose }: BulkTemplateTestDialogProps) {
  const [email, setEmail] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setEmail(getStoredTemplateTestEmail());
    setSelectedIds([]);
    setSendProgress(null);
  }, [open]);

  const selectedTemplates = useMemo(
    () => templates.filter((template) => selectedIds.includes(template.id)),
    [selectedIds, templates],
  );

  const allSelected = templates.length > 0 && selectedIds.length === templates.length;

  const bulkSendMutation = useMutation({
    mutationFn: async () => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        throw new Error('Enter a test email address first.');
      }

      if (selectedTemplates.length === 0) {
        throw new Error('Select at least one template to send.');
      }

      setStoredTemplateTestEmail(trimmedEmail);

      const failures: string[] = [];
      for (let index = 0; index < selectedTemplates.length; index += 1) {
        const template = selectedTemplates[index];
        setSendProgress({ current: index + 1, total: selectedTemplates.length });

        try {
          await testSendTemplate(template.id, { to: trimmedEmail });
        } catch (error) {
          failures.push(`${template.name}: ${getErrorMessage(error, 'Failed to send')}`);
        }
      }

      return {
        email: trimmedEmail,
        sentCount: selectedTemplates.length - failures.length,
        totalCount: selectedTemplates.length,
        failures,
      };
    },
    onSuccess: ({ email: sentEmail, sentCount, totalCount, failures }) => {
      if (failures.length === 0) {
        toast.success(`${sentCount} template${sentCount === 1 ? '' : 's'} sent to ${sentEmail}`);
      } else if (sentCount === 0) {
        toast.error(`No test emails were sent. ${failures[0]}`);
      } else {
        toast.warning(`${sentCount} of ${totalCount} templates sent. ${failures[0]}`);
      }

      setSendProgress(null);
      onClose();
    },
    onError: (error: unknown) => {
      setSendProgress(null);
      toast.error(getErrorMessage(error, 'Failed to send selected templates'));
    },
  });

  const toggleTemplate = (templateId: number, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(templateId) ? current : [...current, templateId];
      }

      return current.filter((id) => id !== templateId);
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? templates.map((template) => template.id) : []);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setStoredTemplateTestEmail(value);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Send Templates</DialogTitle>
          <DialogDescription>
            Send one or more templates to a test inbox. Selected templates are sent one by one to avoid a burst send.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-template-test-email">Test email address</Label>
            <Input
              id="bulk-template-test-email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="bulk-template-select-all"
                  checked={allSelected}
                  onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  disabled={templates.length === 0 || bulkSendMutation.isPending}
                />
                <Label htmlFor="bulk-template-select-all" className="text-sm font-medium">
                  Select all visible templates
                </Label>
              </div>
              <Badge variant="outline">{selectedIds.length} selected</Badge>
            </div>

            <ScrollArea className="h-72">
              <div className="divide-y">
                {templates.map((template) => {
                  const checked = selectedIds.includes(template.id);

                  return (
                    <label
                      key={template.id}
                      htmlFor={`bulk-template-${template.id}`}
                      className="flex cursor-pointer items-start gap-3 px-4 py-3"
                    >
                      <Checkbox
                        id={`bulk-template-${template.id}`}
                        checked={checked}
                        onCheckedChange={(nextChecked) => toggleTemplate(template.id, nextChecked === true)}
                        disabled={bulkSendMutation.isPending}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{template.name}</span>
                          {template.is_system ? <Badge variant="secondary">System</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {template.subject || 'No subject'}
                        </p>
                      </div>
                    </label>
                  );
                })}

                {templates.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No templates available in the current view.
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </div>

          {sendProgress ? (
            <p className="text-sm text-muted-foreground">
              Sending template {sendProgress.current} of {sendProgress.total}...
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={bulkSendMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => bulkSendMutation.mutate()} disabled={bulkSendMutation.isPending || templates.length === 0}>
            <Send className="mr-2 h-4 w-4" />
            {bulkSendMutation.isPending ? 'Sending...' : 'Send selected templates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
