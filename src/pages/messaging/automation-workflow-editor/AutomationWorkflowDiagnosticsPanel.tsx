import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { AutomationSimulationResult, AutomationValidationState } from '@/types/messaging';
import { formatDateTime, getTraceRecipientsText } from './helpers';

interface AutomationWorkflowDiagnosticsPanelProps {
  validationState: AutomationValidationState | null;
  simulationResult: AutomationSimulationResult | null;
}

export function AutomationWorkflowDiagnosticsPanel({ validationState, simulationResult }: AutomationWorkflowDiagnosticsPanelProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {validationState?.valid ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            <h2 className="font-semibold">Validation</h2>
          </div>
          {validationState ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Nodes</div>
                  <div className="mt-1 text-xl font-semibold">{validationState.summary.node_count}</div>
                </div>
                <div className="rounded-2xl border p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Edges</div>
                  <div className="mt-1 text-xl font-semibold">{validationState.summary.edge_count}</div>
                </div>
                <div className="rounded-2xl border p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Reachable Actions</div>
                  <div className="mt-1 text-xl font-semibold">{validationState.summary.reachable_action_count}</div>
                </div>
              </div>

              {validationState.errors.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="mb-2 font-medium">Workflow issues</div>
                  <ul className="list-disc space-y-1 pl-5">
                    {validationState.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Run validation to inspect graph health and node completeness.</div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Simulation Trace</h2>
          </div>
          {!simulationResult?.trace ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Save the workflow, then run a simulation to preview the path and recipients.</div>
          ) : (
            <div className="space-y-3">
              {simulationResult.trace.map((entry, index) => {
                const recipientsText = getTraceRecipientsText(simulationResult, index);
                return (
                  <div key={`${entry.node_id}-${index}`} className="rounded-2xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{entry.node_type}</div>
                      <Badge variant="secondary">{entry.status}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">Node: {entry.node_id}</div>
                    {entry.branch && <div className="mt-2 text-xs text-muted-foreground">Branch: {entry.branch}</div>}
                    {entry.scheduled_for && <div className="mt-2 text-xs text-muted-foreground">Scheduled for: {formatDateTime(entry.scheduled_for)}</div>}
                    {recipientsText && <div className="mt-2 text-xs text-muted-foreground">Recipients: {recipientsText}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
