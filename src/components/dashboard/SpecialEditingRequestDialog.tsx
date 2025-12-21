import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DashboardShootSummary } from '@/types/dashboard';
import { submitEditingRequest } from '@/services/editingRequestService';
import { useToast } from '@/hooks/use-toast';

interface SpecialEditingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shoots: DashboardShootSummary[];
}

const DEFAULT_FORM = {
  shootId: '',
  summary: '',
  details: '',
  priority: 'normal' as 'low' | 'normal' | 'high',
  targetTeam: 'editor' as 'editor' | 'admin' | 'hybrid',
};

export const SpecialEditingRequestDialog: React.FC<SpecialEditingRequestDialogProps> = ({
  open,
  onOpenChange,
  shoots,
}) => {
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const shootOptions = useMemo(() => {
    return shoots.map((shoot) => ({
      id: shoot.id,
      label: `${shoot.addressLine} ${shoot.timeLabel ? `• ${shoot.timeLabel}` : ''}`,
    }));
  }, [shoots]);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.summary.trim()) {
      toast({
        title: 'Summary required',
        description: 'Add a brief title so editors know what to tackle.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      await submitEditingRequest({
        shootId: form.shootId ? Number(form.shootId) : undefined,
        summary: form.summary.trim(),
        details: form.details?.trim() || undefined,
        priority: form.priority,
        targetTeam: form.targetTeam,
      });
      toast({
        title: 'Request sent',
        description: 'Editors and admins have been notified.',
      });
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Unable to submit request',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) {
        resetForm();
      }
      onOpenChange(next);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Special editing request</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm font-medium">Shoot</label>
            <Select value={form.shootId} onValueChange={(value) => setForm((prev) => ({ ...prev, shootId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a shoot (optional)" />
              </SelectTrigger>
              <SelectContent>
                {shootOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Link a shoot if the request is tied to a delivery.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Priority</label>
              <Select value={form.priority} onValueChange={(value: 'low' | 'normal' | 'high') => setForm((prev) => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Route to</label>
              <Select value={form.targetTeam} onValueChange={(value: 'editor' | 'admin' | 'hybrid') => setForm((prev) => ({ ...prev, targetTeam: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editors</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="hybrid">Editors & Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Summary</label>
            <Input
              placeholder="Example: Replace sky on 123 Main St"
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Details</label>
            <Textarea
              rows={4}
              placeholder="Add context, timelines, or links"
              value={form.details}
              onChange={(event) => setForm((prev) => ({ ...prev, details: event.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Submit request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

