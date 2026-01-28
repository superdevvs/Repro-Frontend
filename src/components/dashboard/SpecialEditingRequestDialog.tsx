import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardShootSummary } from '@/types/dashboard';
import { EditingRequest, EditingRequestUpdatePayload, submitEditingRequest } from '@/services/editingRequestService';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, Play, ExternalLink, Trash2 } from 'lucide-react';

interface SpecialEditingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shoots: DashboardShootSummary[];
  onSuccess?: () => void;
  requests?: EditingRequest[];
  selectedRequestId?: number | null;
  onUpdate?: (id: number, payload: EditingRequestUpdatePayload) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

const DEFAULT_FORM = {
  shootId: '',
  summary: '',
  details: '',
  priority: 'normal' as 'low' | 'normal' | 'high',
  targetTeam: 'editor' as 'editor' | 'admin' | 'hybrid',
};

const PRIORITY_STYLES: Record<EditingRequest['priority'], string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  normal: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800',
  high: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800',
};

const STATUS_STYLES: Record<EditingRequest['status'], string> = {
  open: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  in_progress: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-amber-800',
  completed: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
};

const STATUS_LABELS: Record<EditingRequest['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const SpecialEditingRequestDialog: React.FC<SpecialEditingRequestDialogProps> = ({
  open,
  onOpenChange,
  shoots,
  onSuccess,
  requests = [],
  selectedRequestId,
  onUpdate,
  onDelete,
}) => {
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'ongoing'>('new');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (open && selectedRequestId) {
      setActiveTab('ongoing');
    } else if (open) {
      setActiveTab('new');
    }
  }, [open, selectedRequestId]);

  const shootOptions = useMemo(() => {
    return shoots.map((shoot) => ({
      id: shoot.id,
      label: `${shoot.addressLine} ${shoot.timeLabel ? `• ${shoot.timeLabel}` : ''}`,
    }));
  }, [shoots]);

  const activeRequests = useMemo(() => {
    return Array.isArray(requests) ? requests.filter(r => r && r.status !== 'completed') : [];
  }, [requests]);

  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    return requests.find(r => r.id === selectedRequestId);
  }, [requests, selectedRequestId]);

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
      onSuccess?.();
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

  const handleStatusChange = async (id: number, status: EditingRequest['status']) => {
    if (!onUpdate) return;
    
    setActionLoading(id);
    try {
      await onUpdate(id, { status });
      toast({
        title: 'Request updated',
        description: `Status changed to ${STATUS_LABELS[status]}`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!onDelete) return;
    
    setActionLoading(id);
    try {
      await onDelete(id);
      toast({
        title: 'Request deleted',
      });
      if (selectedRequestId === id) {
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) {
        resetForm();
      }
      onOpenChange(next);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Special editing requests</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'ongoing')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Request</TabsTrigger>
            <TabsTrigger value="ongoing">
              Ongoing Requests {activeRequests.length > 0 && `(${activeRequests.length})`}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="new" className="flex-1 overflow-y-auto mt-4">
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
          </TabsContent>

          <TabsContent value="ongoing" className="flex-1 overflow-y-auto mt-4 px-1">
            <div className="space-y-3 pb-1">
              {activeRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No active requests</p>
                </div>
              ) : (
                activeRequests.map((request) => {
                  const isLoading = actionLoading === request.id;
                  const isSelected = selectedRequestId === request.id;
                  let createdLabel: string | null = null;
                  try {
                    if (request.created_at) {
                      const date = new Date(request.created_at);
                      if (!isNaN(date.getTime())) {
                        createdLabel = format(date, 'MMM d, yyyy • h:mm a');
                      }
                    }
                  } catch {
                    createdLabel = null;
                  }

                  return (
                    <div
                      key={request.id}
                      className={cn(
                        "rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3",
                        isSelected && "ring-2 ring-inset ring-primary",
                        isLoading && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground mb-1">{request.summary || 'Untitled request'}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn('text-xs font-semibold border', PRIORITY_STYLES[request.priority] || PRIORITY_STYLES.normal)}>
                              {request.priority || 'normal'}
                            </Badge>
                            <Badge className={cn('text-xs font-semibold border', STATUS_STYLES[request.status] || STATUS_STYLES.open)}>
                              {STATUS_LABELS[request.status] || 'Open'}
                            </Badge>
                          </div>
                        </div>
                        {request.shoot_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/shoots/${request.shoot_id}`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      {request.details && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.details}</p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {request.shoot?.address && (
                          <span>Shoot: {request.shoot.address}</span>
                        )}
                        {request.tracking_code && (
                          <span>Tracking: {request.tracking_code}</span>
                        )}
                        {createdLabel && <span>{createdLabel}</span>}
                        {request.requester?.name && (
                          <span>Requested by: {request.requester.name}</span>
                        )}
                      </div>

                      {onUpdate && request.status !== 'completed' && (
                        <div className="flex gap-2 pt-2 border-t">
                          {request.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(request.id, 'in_progress')}
                              disabled={isLoading}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start working
                            </Button>
                          )}
                          {request.status === 'in_progress' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(request.id, 'open')}
                              disabled={isLoading}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Mark as open
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(request.id, 'completed')}
                            disabled={isLoading}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark complete
                          </Button>
                          {onDelete && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(request.id)}
                              disabled={isLoading}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
