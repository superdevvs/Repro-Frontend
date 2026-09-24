import { EmptyState } from '@/components/ui/empty-state';
import { usePageLoading } from '@/hooks/use-page-loading';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CopyPlus, MoreVertical, Pencil, Play, Plus, Trash2, Workflow } from 'lucide-react';
import { toast } from '@/lib/sonner-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AutomationEditorDialog } from '@/components/messaging/automations/AutomationEditorDialog';
import { EmailNavigation } from '@/components/messaging/email/EmailNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { deleteAutomation, getAutomations, runAutomation, toggleAutomation } from '@/services/messaging';
import type { AutomationRule } from '@/types/messaging';
import { extractSimpleAutomationDraft, triggerLabels } from '@/components/messaging/automations/workflow-utils';
import { asString, getMutationErrorMessage } from './automation-workflow-editor/helpers';
import { automationMoments, momentForTrigger, recipientSummary, whenSummary, type AutomationMomentId } from './automationMoments';

const latestRun = (automation: AutomationRule) => automation.recent_runs?.[0] ?? null;

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

function automationHaystack(automation: AutomationRule) {
  return [
    automation.name,
    automation.description,
    triggerLabels[automation.trigger_type],
    automation.trigger_type,
    recipientSummary(automation),
    whenSummary(automation),
    automation.template?.name,
    getPrimaryActionSummary(automation),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function JobRow({
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
  const run = latestRun(automation);
  const validationMessage = getValidationMessage(automation);
  const issue = !automation.validation_state?.valid ? validationMessage : run?.error_message;
  const sends = automation.template?.name || getPrimaryActionSummary(automation);

  return (
    <article className={`grid gap-3 border-b px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_minmax(8rem,0.8fr)_auto] lg:items-center ${automation.is_active ? '' : 'opacity-70'}`}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold">
          <button type="button" className="text-left text-foreground" onClick={() => onOpen(automation)}>
            {automation.name}
          </button>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {automation.description || triggerLabels[automation.trigger_type] || automation.trigger_type}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {automation.scope === 'SYSTEM' ? 'Built in' : 'Custom'}
          {automation.is_system_locked ? ' · Locked path' : ''}
          {run?.status ? ` · Last run ${run.status}` : ''}
        </p>
        {issue && (
          <p className="mt-2 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{issue}</span>
          </p>
        )}
      </div>
      <div>
        <div className="text-xs text-muted-foreground lg:hidden">Who</div>
        <div className="text-sm">{recipientSummary(automation)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground lg:hidden">When</div>
        <div className="text-sm">{whenSummary(automation)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground lg:hidden">Sends</div>
        <div className="text-sm">{sends}</div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(automation)}>
          {issue ? 'Fix' : 'Change'}
        </Button>
        <Switch checked={automation.is_active} onCheckedChange={() => onToggle(automation)} aria-label={`Turn ${automation.name} ${automation.is_active ? 'off' : 'on'}`} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`More actions for ${automation.name}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(automation)}>
              <Workflow className="mr-2 h-4 w-4" />
              Open workflow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(automation)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit in form
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(automation)}>
              <CopyPlus className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            {automation.scope === 'SYSTEM' && (
              <DropdownMenuItem onClick={() => onRun(automation)} disabled={runningId === automation.id}>
                <Play className="mr-2 h-4 w-4" />
                Run now
              </DropdownMenuItem>
            )}
            {automation.scope !== 'SYSTEM' && (
              <DropdownMenuItem onClick={() => onDelete(automation)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export default function Automations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [draftAutomation, setDraftAutomation] = useState<AutomationRule | null>(null);
  const [dialogMode, setDialogMode] = useState<'create' | 'duplicate' | 'edit'>('create');
  const [query, setQuery] = useState('');
  const [moment, setMoment] = useState<AutomationMomentId>('Booking');

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => getAutomations(),
  });

  usePageLoading(isLoading);

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

  const needle = query.trim().toLowerCase();
  const grouped = useMemo(() => {
    return automationMoments.map((group) => {
      const inMoment = automations.filter((automation) => momentForTrigger(automation.trigger_type) === group.id);
      const matched = inMoment.filter((automation) => !needle || automationHaystack(automation).includes(needle));
      return {
        ...group,
        total: inMoment.length,
        on: inMoment.filter((automation) => automation.is_active).length,
        needsFix: inMoment.some((automation) => !automation.validation_state?.valid || Boolean(latestRun(automation)?.error_message)),
        matched,
      };
    });
  }, [automations, needle]);
  const selected = grouped.find((group) => group.id === moment) ?? grouped[0];
  const elsewhere = needle
    ? grouped.filter((group) => group.id !== selected.id && group.matched.length > 0)
    : [];

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
      <div className="space-y-5 px-0 pt-1.5 pb-3 sm:p-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Automations</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Pick the part of the job, then change who gets the message.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/messaging/email/automations/new')}>
              <Workflow className="mr-2 h-4 w-4" />
              Advanced editor
            </Button>
            <Button onClick={() => openCreateDialog('create', null)}>
              <Plus className="mr-2 h-4 w-4" />
              New automation
            </Button>
          </div>
        </header>

        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, person, or message"
          aria-label="Search automations"
          className="max-w-xl"
        />

        {elsewhere.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Also in{' '}
            {elsewhere.map((group) => (
              <button
                key={group.id}
                type="button"
                className="mr-2 underline-offset-2 hover:underline"
                onClick={() => setMoment(group.id)}
              >
                {group.id} ({group.matched.length})
              </button>
            ))}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Moments">
            {grouped.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-current={moment === group.id ? 'true' : undefined}
                aria-label={`${group.id} moment`}
                className={`flex min-w-[9rem] items-center justify-between rounded-2xl border px-3 py-3 text-left lg:min-w-0 ${moment === group.id ? 'border-primary bg-primary/5' : 'bg-card'}`}
                onClick={() => setMoment(group.id)}
              >
                <span className="font-medium">
                  {group.id}
                  {group.needsFix ? <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500" aria-label="Needs a fix" /> : null}
                </span>
                <span className="text-xs text-muted-foreground">{needle ? `${group.matched.length} found` : `${group.on} on`}</span>
              </button>
            ))}
          </nav>

          <section className="overflow-hidden rounded-3xl border bg-card">
            <p className="border-b px-4 py-3 text-sm text-muted-foreground">
              {needle
                ? `${selected.matched.length} ${selected.matched.length === 1 ? 'match' : 'matches'} in ${selected.id}.`
                : `${selected.id}. ${selected.intro} ${selected.on} of ${selected.total} are on.`}
            </p>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_minmax(8rem,0.8fr)_auto] gap-3 px-4 py-2 text-xs text-muted-foreground lg:grid">
              <span />
              <span>Who</span>
              <span>When</span>
              <span>Sends</span>
              <span />
            </div>
            {isLoading ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">Loading automations...</p>
            ) : selected.matched.length === 0 ? (
              <div className="px-4 py-8">
                <EmptyState
                  icon="automations"
                  title={needle ? <>Nothing in this moment matches that search.</> : <>Nothing in this moment yet.</>}
                  size="compact"
                />
                {!needle && (
                  <Button className="mt-4" onClick={() => openCreateDialog('create', null)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New automation
                  </Button>
                )}
              </div>
            ) : (
              selected.matched.map((automation) => (
                <JobRow
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
              ))
            )}
          </section>
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
