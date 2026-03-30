import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  CopyPlus,
  Pencil,
  MoreVertical,
  Play,
  Plus,
  Shield,
  Trash2,
  Workflow,
  XCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AutomationEditorDialog } from '@/components/messaging/automations/AutomationEditorDialog';
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
import { extractSimpleAutomationDraft, triggerLabels } from '@/components/messaging/automations/workflow-utils';
import { asString, formatDateTime, getMutationErrorMessage, summarizeSchedule } from './automation-workflow-editor/helpers';

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

const getPrimaryActionSummary = (automation: AutomationRule) => {
  const actionNode = automation.workflow_definition_json?.nodes?.find((node) => node.type.startsWith('action.'));
  if (!actionNode) {
    if (automation.workflow_definition_json?.meta?.system_command) {
      return 'System command workflow';
    }

    return 'No action configured';
  }

  switch (actionNode.type) {
    case 'action.sms':
      return Number(actionNode.config?.templateId) ? 'SMS template' : 'Inline SMS';
    case 'action.internal_notification':
      return asString(actionNode.config?.title, 'Internal notification');
    default:
      return Number(actionNode.config?.templateId) ? 'Email template' : 'Inline email';
  }
};

const getValidationMessage = (automation: AutomationRule) => {
  const firstError = automation.validation_state?.errors?.[0];
  if (firstError) {
    return firstError;
  }

  const firstNodeError = Object.values(automation.validation_state?.node_errors ?? {}).flat()[0];
  return firstNodeError || null;
};

function AutomationCard({
  automation,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onRun,
  runningId,
}: {
  automation: AutomationRule;
  onOpen: (automation: AutomationRule) => void;
  onEdit: (automation: AutomationRule) => void;
  onDuplicate: (automation: AutomationRule) => void;
  onDelete: (automation: AutomationRule) => void;
  onToggle: (automation: AutomationRule) => void;
  onRun: (automation: AutomationRule) => void;
  runningId?: number | null;
}) {
  const flowSummary = summarizeFlow(automation.workflow_definition_json);
  const run = latestRun(automation);
  const validationMessage = getValidationMessage(automation);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
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
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Trigger</div>
              <div className="mt-1 font-medium">{triggerLabels[automation.trigger_type] || automation.trigger_type}</div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Timing</div>
              <div className="mt-1 text-sm text-muted-foreground">{summarizeSchedule(automation.workflow_definition_json ?? { nodes: [], edges: [] }, automation)}</div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Action</div>
              <div className="mt-1 text-sm text-muted-foreground">{getPrimaryActionSummary(automation)}</div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Last Run</div>
              <div className="mt-1 text-sm text-muted-foreground">{formatDateTime(run?.started_at || run?.scheduled_for)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-3 py-1">{flowSummary.nodeCount} nodes</span>
            <span className="rounded-full border px-3 py-1">{flowSummary.actionCount} actions</span>
            <span className="rounded-full border px-3 py-1">{flowSummary.conditionCount} conditions</span>
            <span className="rounded-full border px-3 py-1">{flowSummary.waitCount} waits</span>
          </div>

          {!automation.validation_state?.valid && validationMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Workflow needs attention
              </div>
              <div className="mt-1">{validationMessage}</div>
            </div>
          )}

          {run?.error_message && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="font-medium">Last run failure</div>
              <div className="mt-1">{run.error_message}</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 lg:flex-col lg:items-end">
          <Switch checked={automation.is_active} onCheckedChange={() => onToggle(automation)} />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="default" size="sm" onClick={() => onOpen(automation)}>
              <Workflow className="mr-2 h-4 w-4" />
              Open Workflow
            </Button>

            <Button variant="outline" size="sm" onClick={() => onEdit(automation)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit in Form
            </Button>

            <Button variant="outline" size="sm" onClick={() => onDuplicate(automation)}>
              <CopyPlus className="mr-2 h-4 w-4" />
              Duplicate
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
                <DropdownMenuItem onClick={() => onEdit(automation)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit in Form
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(automation)}>
                  <CopyPlus className="mr-2 h-4 w-4" />
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
      </div>
    </Card>
  );
}

export default function Automations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [draftAutomation, setDraftAutomation] = useState<AutomationRule | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'duplicate' | 'edit'>('create');

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
    onError: (error: unknown) => {
      toast.error(getMutationErrorMessage(error, 'Failed to delete automation'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAutomation,
    onSuccess: async (updatedAutomation) => {
      toast.success(updatedAutomation.is_active ? 'Automation enabled' : 'Automation disabled');
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
      await queryClient.invalidateQueries({ queryKey: ['automation', updatedAutomation.id] });
    },
    onError: (error: unknown) => {
      toast.error(getMutationErrorMessage(error, 'Failed to toggle automation'));
    },
  });

  const runMutation = useMutation({
    mutationFn: runAutomation,
    onSuccess: async ({ automation }) => {
      toast.success(`${automation.name} executed`);
      await queryClient.invalidateQueries({ queryKey: ['automations'] });
      await queryClient.invalidateQueries({ queryKey: ['automation', automation.id] });
    },
    onError: (error: unknown) => {
      toast.error(getMutationErrorMessage(error, 'Failed to run automation'));
    },
  });

  const { systemAutomations, customAutomations } = useMemo(
    () => ({
      systemAutomations: automations.filter((automation) => automation.scope === 'SYSTEM'),
      customAutomations: automations.filter((automation) => automation.scope !== 'SYSTEM'),
    }),
    [automations],
  );

  const openCreateDialog = (mode: 'create' | 'duplicate' | 'edit', automation: AutomationRule | null = null) => {
    setDialogMode(mode);
    setDraftAutomation(automation);
    setIsCreateDialogOpen(true);
  };

  const handleCreateSuccess = async (automation: AutomationRule) => {
    setIsCreateDialogOpen(false);
    setDraftAutomation(null);
    await queryClient.invalidateQueries({ queryKey: ['automations'] });
    navigate(`/messaging/email/automations/${automation.id}`);
  };

  const handleDelete = (automation: AutomationRule) => {
    if (automation.scope === 'SYSTEM') {
      toast.error('Cannot delete system automation');
      return;
    }

    if (window.confirm(`Delete "${automation.name}"?`)) {
      deleteMutation.mutate(automation.id);
    }
  };

  const handleDuplicate = (automation: AutomationRule) => {
    const simpleDraft = extractSimpleAutomationDraft(automation);
    if (simpleDraft && simpleDraft.action_type !== 'system_command') {
      openCreateDialog('duplicate', automation);
      return;
    }

    navigate('/messaging/email/automations/new', {
      state: {
        duplicateAutomation: {
          ...automation,
          scope: automation.scope === 'SYSTEM' ? 'GLOBAL' : automation.scope,
          is_system_locked: false,
        },
      },
    });
  };

  const handleEdit = (automation: AutomationRule) => {
    openCreateDialog('edit', automation);
  };

  return (
    <DashboardLayout>
      <EmailNavigation />
      <div className="space-y-6 px-2 pt-3 pb-3 sm:p-6">
        <Card className="overflow-hidden border-none bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-0 text-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                <Zap className="h-3.5 w-3.5" />
                Messaging Automation
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">Automation Workflows</h1>
              <p className="mt-3 text-sm text-slate-300 sm:text-base">
                Start simple with a guided form, then open the visual workflow only when you need branching, advanced waits, or deeper inspection.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                  Common-case setup in one modal
                </span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                  System workflows stay visible and locked
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => openCreateDialog('create', null)}>
                <Plus className="mr-2 h-4 w-4" />
                New Automation
              </Button>
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigate('/messaging/email/automations/new')}
              >
                <Workflow className="mr-2 h-4 w-4" />
                Advanced Editor
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">System Workflows</div>
              <div className="mt-2 text-2xl font-semibold">{systemAutomations.length}</div>
              <div className="text-sm text-muted-foreground">Locked operational automations</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Custom Workflows</div>
              <div className="mt-2 text-2xl font-semibold">{customAutomations.length}</div>
              <div className="text-sm text-muted-foreground">Built from the form or the visual editor</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Active</div>
              <div className="mt-2 text-2xl font-semibold">{automations.filter((automation) => automation.is_active).length}</div>
              <div className="text-sm text-muted-foreground">Currently enabled</div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Needs Review</div>
              <div className="mt-2 text-2xl font-semibold">{automations.filter((automation) => !automation.validation_state?.valid).length}</div>
              <div className="text-sm text-muted-foreground">Validation issues or missing config</div>
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
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Custom Automations</h2>
              <p className="text-sm text-muted-foreground">Use the quick builder for the common case, then open the visual workflow when you want more control.</p>
            </div>
            <Button variant="outline" onClick={() => openCreateDialog('create', null)}>
              <Plus className="mr-2 h-4 w-4" />
              Create with Form
            </Button>
          </div>

          {customAutomations.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No custom automations yet.</p>
              <Button onClick={() => openCreateDialog('create', null)} className="mt-4">
                Create your first automation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {customAutomations.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onOpen={(item) => navigate(`/messaging/email/automations/${item.id}`)}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
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

      <AutomationEditorDialog
        automation={draftAutomation}
        mode={dialogMode}
        open={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setDraftAutomation(null);
        }}
        onSuccess={handleCreateSuccess}
      />
    </DashboardLayout>
  );
}
