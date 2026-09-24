import { AlertTriangle, CheckCircle2, Play, Plus, Sparkles } from 'lucide-react';
import { InlineSpinner as Loader2 } from '@/components/ui/inline-spinner';
import { Button } from '@/components/ui/button';
import type { AutomationSimulationResult, AutomationValidationState, WorkflowNodeType } from '@/types/messaging';
import { AutomationWorkflowDiagnosticsPanel } from './AutomationWorkflowDiagnosticsPanel';
import type { WorkflowSummary } from './helpers';

interface AutomationWorkflowDockProps {
  summary: WorkflowSummary;
  validationState: AutomationValidationState | null;
  simulationResult: AutomationSimulationResult | null;
  isReadOnlyMobile: boolean;
  isStructureLocked: boolean;
  canRun: boolean;
  hasSavedAutomation: boolean;
  nodePalette: Array<{ type: WorkflowNodeType; label: string }>;
  validatePending: boolean;
  simulatePending: boolean;
  runPending: boolean;
  onAddNode: (type: WorkflowNodeType) => void;
  onValidate: () => void;
  onSimulate: () => void;
  onRun: () => void;
}

export function AutomationWorkflowDock({
  summary,
  validationState,
  simulationResult,
  isReadOnlyMobile,
  isStructureLocked,
  canRun,
  hasSavedAutomation,
  nodePalette,
  validatePending,
  simulatePending,
  runPending,
  onAddNode,
  onValidate,
  onSimulate,
  onRun,
}: AutomationWorkflowDockProps) {
  const validationLabel = !validationState
    ? 'Not checked yet'
    : validationState.valid
      ? 'Ready to save'
      : 'Needs a fix';

  return (
    <section className="rounded-2xl border bg-card p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="shrink-0">
          <div className="text-sm font-semibold">Validation</div>
          <p className={`mt-0.5 flex items-center gap-1.5 text-sm ${validationState?.valid ? 'text-emerald-700' : 'text-muted-foreground'}`}>
            {validationState?.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {validationLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {summary.totalNodes} nodes · {summary.totalEdges} edges · {summary.actionCount} {summary.actionCount === 1 ? 'action' : 'actions'}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 text-sm text-muted-foreground">Add a step</div>
          {isReadOnlyMobile ? (
            <p className="text-sm text-muted-foreground">Open this page on a larger screen to add or connect steps.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {nodePalette.map((item) => (
                <Button
                  key={item.type}
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => onAddNode(item.type)}
                  disabled={isStructureLocked}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {item.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex xl:shrink-0">
          <Button variant="outline" onClick={onValidate} disabled={validatePending}>
            {validatePending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Validate
          </Button>
          <Button variant="outline" onClick={onSimulate} disabled={!hasSavedAutomation || simulatePending}>
            {simulatePending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Run simulation
          </Button>
          <Button variant="outline" onClick={onRun} disabled={!canRun || runPending}>
            {runPending ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            Run now
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <AutomationWorkflowDiagnosticsPanel validationState={validationState} simulationResult={simulationResult} />
      </div>
    </section>
  );
}
