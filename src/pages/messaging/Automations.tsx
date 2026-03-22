import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, MoreVertical, Play, Plus, Shield, Trash2, Workflow, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { deleteAutomation, getAutomations, runAutomation, toggleAutomation } from '@/services/messaging';
import type { AutomationRule, WorkflowDefinition } from '@/types/messaging';
import { triggerLabels } from '@/components/messaging/automations/workflow-utils';

const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not run yet';

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const summarizeSchedule = (automation: AutomationRule) => {
  const workflow = automation.workflow_definition_json;
  const triggerNode = workflow?.nodes?.find((node) => String(node.type).startsWith('trigger.'));

  if (triggerNode?.type === 'trigger.schedule') {
    const schedule = triggerNode.config?.schedule ?? {};
    const dayLabel = weekdayLabels[Math.max(0, Math.min(6, Number(schedule.day_of_week ?? 1)))] ?? 'Monday';
    return `${schedule.type || 'weekly'} on ${dayLabel} at ${schedule.time || '01:00'}`;
  }

  if (automation.schedule_json?.offset) {
    return `Offset ${automation.schedule_json.offset}`;
  }

  return 'Event-driven';
};

const summarizeFlow = (workflow?: WorkflowDefinition) => {
  const nodes = workflow?.nodes ?? [];
  return {
    nodeCount: nodes.length,
    actionCount: nodes.filter((node) => node.type.startsWith('action.')).length,
    waitCount: nodes.filter((node) => node.type.startsWith('wait.')).length,
    conditionCount: nodes.filter((node) => node.type === 'condition.if').length,
  };
};

const latestRun = (automation: AutomationRule) => automation.recent_runs?.[0] ?? null;

const statusTone = (status?: string) => {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'failed') return 'bg-red-100 text-red-800';
  if (status === 'waiting') return 'bg-amber-100 text-amber-800';
  if (status === 'running') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
};

function AutomationCard({
  automation,
  onOpen,
  onDuplicate,
  onDelete,
  onToggle,
  onRun,
  runningId,
}: {
  automation: AutomationRule;
  onOpen: (automation: AutomationRule) => void;
  onDuplicate: (automation: AutomationRule) => void;
  onDelete: (automation: AutomationRule) => void;
  onToggle: (automation: AutomationRule) => void;
  onRun: (automation: AutomationRule) => void;
  runningId?: number | null;
}) {
  const flowSummary = summarizeFlow(automation.workflow_definition_json);
  const run = latestRun(automation);

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{automation.name}</h3>
            <Badge variant="outline">{automation.scope}</Badge>
            {automation.is_system_locked && (
              <Badge className="bg-amber-100 text-amber-800">
                <Shield className="mr-1 h-3.5 w-3.5" />
                Locked
              </Badge>
            )}
            {automation.is_active ? (
              <Badge className="bg-emerald-100 text-emerald-800">
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-600">
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Inactive
              </Badge>
            )}
            <Badge className={statusTone(run?.status)}>{run?.status || 'idle'}</Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            {automation.description || 'No description added yet.'}
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Trigger</div>
              <div className="mt-1 font-medium">{triggerLabels[automation.trigger_type] || automation.trigger_type}</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Schedule</div>
              <div className="mt-1 text-sm text-muted-foreground">{summarizeSchedule(automation)}</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workflow</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {flowSummary.nodeCount} nodes, {flowSummary.actionCount} actions
              </div>
              <div className="text-xs text-muted-foreground">
                {flowSummary.conditionCount} conditions, {flowSummary.waitCount} waits
              </div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Last Run</div>
              <div className="mt-1 text-sm text-muted-foreground">{formatDateTime(run?.started_at || run?.scheduled_for)}</div>
            </div>
          </div>

          {!automation.validation_state?.valid && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-medium">Workflow needs attention</div>
              <div className="mt-1">
                {(automation.validation_state?.errors ?? []).slice(0, 2).join(' ')}
              </div>
            </div>
          )}

          {run?.error_message && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="font-medium">Last run failure</div>
              <div className="mt-1">{run.error_message}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 xl:flex-col xl:items-end">
          <Switch checked={automation.is_active} onCheckedChange={() => onToggle(automation)} />
          <Button variant="outline" size="sm" onClick={() => onOpen(automation)}>
            <Workflow className="mr-2 h-4 w-4" />
            Open Workflow
          </Button>
          {automation.scope === 'SYSTEM' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRun(automation)}
              disabled={runningId === automation.id}
            >
              <Play className="mr-2 h-4 w-4" />
              Run now
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(automation)}>
                <Workflow className="mr-2 h-4 w-4" />
                Open Workflow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(automation)}>
                <Plus className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              {automation.scope !== 'SYSTEM' && (
                <DropdownMenuItem onClick={() => onDelete(automation)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

export default function Automations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => getAutomations(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: async () => {
      toast.success('Automation deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to delete automation');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAutomation,
    onSuccess: async (updatedAutomation) => {
      toast.success(updatedAutomation.is_active ? 'Automation enabled' : 'Automation disabled');
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
      await queryClient.invalidateQueries({ queryKey: ['automation', updatedAutomation.id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to toggle automation');
    },
  });

  const runMutation = useMutation({
    mutationFn: runAutomation,
    onSuccess: async ({ automation }) => {
      toast.success(`${automation.name} executed`);
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
      await queryClient.invalidateQueries({ queryKey: ['automation', automation.id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to run automation');
    },
  });

  const { systemAutomations, customAutomations } = useMemo(() => ({
    systemAutomations: automations.filter((automation) => automation.scope === 'SYSTEM'),
    customAutomations: automations.filter((automation) => automation.scope !== 'SYSTEM'),
  }), [automations]);

  const handleDelete = (automation: AutomationRule) => {
    if (automation.scope === 'SYSTEM') {
      toast.error('Cannot delete system automation');
      return;
    }

    if (window.confirm(`Delete "${automation.name}"?`)) {
      deleteMutation.mutate(automation.id);
    }
  };

  return (
    <DashboardLayout>
      <EmailNavigation />
      <div className="space-y-6 px-2 pt-3 pb-3 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Automation Workflows</h1>
            <p className="mt-2 text-muted-foreground">
              Design multi-step messaging workflows, inspect weekly system automations, and validate execution history from one place.
            </p>
          </div>
          <Button onClick={() => navigate('/messaging/email/automations/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Automation
          </Button>
        </div>

        <Card className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">System Workflows</div>
              <div className="mt-2 text-2xl font-semibold">{systemAutomations.length}</div>
              <div className="text-sm text-muted-foreground">Weekly automation backbone</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Custom Workflows</div>
              <div className="mt-2 text-2xl font-semibold">{customAutomations.length}</div>
              <div className="text-sm text-muted-foreground">Editable visual automations</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Active</div>
              <div className="mt-2 text-2xl font-semibold">{automations.filter((automation) => automation.is_active).length}</div>
              <div className="text-sm text-muted-foreground">Currently enabled</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Needs Review</div>
              <div className="mt-2 text-2xl font-semibold">{automations.filter((automation) => !automation.validation_state?.valid).length}</div>
              <div className="text-sm text-muted-foreground">Workflows with validation issues</div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Required System Automations</h2>
          </div>
          {isLoading ? (
            <Card className="p-6 text-sm text-muted-foreground">Loading automations...</Card>
          ) : systemAutomations.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">No system automations found.</Card>
          ) : (
            <div className="space-y-3">
              {systemAutomations.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onOpen={(item) => navigate(`/messaging/email/automations/${item.id}`)}
                  onDuplicate={(item) => navigate('/messaging/email/automations/new', { state: { duplicateAutomation: item } })}
                  onDelete={handleDelete}
                  onToggle={(item) => toggleMutation.mutate(item.id)}
                  onRun={(item) => runMutation.mutate(item.id)}
                  runningId={runMutation.variables ?? null}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Custom Automations</h2>
          {customAutomations.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No custom automations yet.</p>
              <Button onClick={() => navigate('/messaging/email/automations/new')} className="mt-4">
                Create your first workflow
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {customAutomations.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onOpen={(item) => navigate(`/messaging/email/automations/${item.id}`)}
                  onDuplicate={(item) => navigate('/messaging/email/automations/new', { state: { duplicateAutomation: item } })}
                  onDelete={handleDelete}
                  onToggle={(item) => toggleMutation.mutate(item.id)}
                  onRun={(item) => runMutation.mutate(item.id)}
                  runningId={runMutation.variables ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
