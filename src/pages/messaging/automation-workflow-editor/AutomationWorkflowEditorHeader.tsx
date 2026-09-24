import { ArrowLeft, CopyPlus, Save, Shield, Workflow } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AutomationRule, AutomationTriggerType } from '@/types/messaging';
import type { AutomationEditorMeta } from './helpers';
import { summarizeSchedule } from './helpers';
import { triggerLabels } from '@/components/messaging/automations/workflow-utils';

interface AutomationWorkflowEditorHeaderProps {
  automationId?: string;
  meta: AutomationEditorMeta;
  triggerType: AutomationTriggerType;
  isReadOnlyMobile: boolean;
  isDirty: boolean;
  currentAutomation: AutomationRule | null;
  currentWorkflow: AutomationRule['workflow_definition_json'];
  savePending: boolean;
  togglePending: boolean;
  onBack: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
}

export function AutomationWorkflowEditorHeader({
  automationId,
  meta,
  triggerType,
  isReadOnlyMobile,
  isDirty,
  currentAutomation,
  currentWorkflow,
  savePending,
  togglePending,
  onBack,
  onSave,
  onDuplicate,
  onToggle,
}: AutomationWorkflowEditorHeaderProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {meta.is_system_locked && (
            <Badge className="bg-amber-100 text-amber-800">
              <Shield className="mr-1 h-3.5 w-3.5" />
              Locked path
            </Badge>
          )}
          {isReadOnlyMobile && <Badge variant="outline">Viewing</Badge>}
          {isDirty && <Badge className="bg-amber-100 text-amber-800">Unsaved</Badge>}
        </div>
        <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">
          {meta.name.trim() || (automationId ? 'Workflow' : 'New workflow')}
        </h1>
        <p className="truncate text-sm text-muted-foreground">
          {triggerLabels[triggerType] || triggerType}
          {' · '}
          {summarizeSchedule(currentWorkflow ?? { nodes: [], edges: [] }, currentAutomation)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onDuplicate} disabled={!currentAutomation}>
          <CopyPlus className="mr-2 h-4 w-4" />
          Duplicate
        </Button>
        <Button variant="outline" onClick={onToggle} disabled={!automationId || togglePending}>
          <Workflow className="mr-2 h-4 w-4" />
          {meta.is_active ? 'Pause' : 'Activate'}
        </Button>
        <Button onClick={onSave} disabled={savePending || isReadOnlyMobile}>
          {savePending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>
    </div>
  );
}
