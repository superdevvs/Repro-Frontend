import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CopyPlus,
  Loader2,
  Play,
  Save,
  Shield,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AutomationRule, AutomationTriggerType } from '@/types/messaging';
import type { AutomationEditorMeta, WorkflowSummary } from './helpers';
import { summarizeSchedule } from './helpers';
import { triggerLabels } from '@/components/messaging/automations/workflow-utils';

interface AutomationWorkflowEditorHeaderProps {
  automationId?: string;
  meta: AutomationEditorMeta;
  triggerType: AutomationTriggerType;
  summary: WorkflowSummary;
  isReadOnlyMobile: boolean;
  isDirty: boolean;
  currentAutomation: AutomationRule | null;
  currentWorkflow: AutomationRule['workflow_definition_json'];
  validationValid: boolean;
  validatePending: boolean;
  savePending: boolean;
  simulatePending: boolean;
  togglePending: boolean;
  runPending: boolean;
  onBack: () => void;
  onSave: () => void;
  onValidate: () => void;
  onSimulate: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onRun: () => void;
}

export function AutomationWorkflowEditorHeader({
  automationId,
  meta,
  triggerType,
  summary,
  isReadOnlyMobile,
  isDirty,
  currentAutomation,
  currentWorkflow,
  validationValid,
  validatePending,
  savePending,
  simulatePending,
  togglePending,
  runPending,
  onBack,
  onSave,
  onValidate,
  onSimulate,
  onDuplicate,
  onToggle,
  onRun,
}: AutomationWorkflowEditorHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border bg-card/70 p-4 shadow-sm backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Badge variant="outline">{automationId ? 'Existing workflow' : 'New workflow'}</Badge>
            {meta.is_system_locked && (
              <Badge className="bg-amber-100 text-amber-800">
                <Shield className="mr-1 h-3.5 w-3.5" />
                System-locked structure
              </Badge>
            )}
            {isReadOnlyMobile && <Badge className="bg-slate-100 text-slate-700">Mobile viewer mode</Badge>}
            {isDirty && <Badge className="bg-amber-100 text-amber-800">Unsaved changes</Badge>}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {meta.name.trim() || (automationId ? 'Workflow Editor' : 'Create Workflow Automation')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Build multi-step automations with a visual workflow, inspect weekly system flows, and validate behavior before it goes live.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Button onClick={onSave} disabled={savePending || isReadOnlyMobile}>
            {savePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" onClick={onValidate} disabled={validatePending}>
            {validatePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Validate
          </Button>
          <Button variant="outline" onClick={onSimulate} disabled={!automationId || simulatePending}>
            {simulatePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Simulate
          </Button>
          <Button variant="outline" onClick={onDuplicate} disabled={!currentAutomation}>
            <CopyPlus className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          <Button variant="outline" onClick={onToggle} disabled={!automationId || togglePending}>
            <Workflow className="mr-2 h-4 w-4" />
            {meta.is_active ? 'Pause' : 'Activate'}
          </Button>
          <Button variant="outline" onClick={onRun} disabled={!automationId || meta.scope !== 'SYSTEM' || runPending}>
            {runPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run now
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-muted/30 p-4">
        <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {meta.editor_mode === 'simple' ? 'Simple Build Summary' : 'Workflow Summary'}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border bg-background px-3 py-1 font-medium">
            {triggerLabels[triggerType] || triggerType}
          </span>
          {summary.conditionCount > 0 && (
            <>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full border bg-background px-3 py-1 font-medium">Condition</span>
            </>
          )}
          {summary.waitCount > 0 && (
            <>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full border bg-background px-3 py-1 font-medium">Wait</span>
            </>
          )}
          {summary.actionCount > 0 && (
            <>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full border bg-background px-3 py-1 font-medium">
                {summary.actionCount === 1 ? 'Action' : `${summary.actionCount} Actions`}
              </span>
            </>
          )}
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="rounded-full border bg-background px-3 py-1 font-medium">End</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {meta.editor_mode === 'simple'
            ? 'This workflow started from the quick form. You can keep it simple or expand it here with extra conditions, waits, and branches.'
            : 'Use the canvas for advanced edits, node inspection, and execution validation.'}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Trigger</div>
          <div className="mt-2 text-lg font-semibold">{triggerLabels[triggerType] || triggerType}</div>
          <div className="mt-1 text-sm text-muted-foreground">{summarizeSchedule(currentWorkflow ?? { nodes: [], edges: [] }, currentAutomation)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Workflow Graph</div>
          <div className="mt-2 text-lg font-semibold">{summary.totalNodes} nodes</div>
          <div className="mt-1 text-sm text-muted-foreground">{summary.totalEdges} connections</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Actions</div>
          <div className="mt-2 text-lg font-semibold">{summary.actionCount}</div>
          <div className="mt-1 text-sm text-muted-foreground">{summary.waitCount} waits, {summary.conditionCount} conditions</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status</div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${meta.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <div className="text-lg font-semibold">{meta.is_active ? 'Active' : 'Inactive'}</div>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{validationValid ? 'Validation passed' : 'Review validation panel below'}</div>
        </Card>
      </div>
    </div>
  );
}
