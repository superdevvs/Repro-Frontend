import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';

export function AutomationWorkflowNode({ data }: NodeProps) {
  const Icon = data.icon;
  const hasError = Array.isArray(data.validationErrors) && data.validationErrors.length > 0;
  const isCondition = data.rawNode?.type === 'condition.if';
  const isTrigger = String(data.rawNode?.type || '').startsWith('trigger.');
  const isEnd = data.rawNode?.type === 'end';

  return (
    <div className={`min-w-[220px] rounded-2xl border bg-card/95 shadow-lg backdrop-blur ${hasError ? 'border-red-400' : 'border-border'}`}>
      {!isTrigger && <Handle type="target" position={Position.Top} className="!bg-primary" />}
      <div className={`rounded-t-2xl bg-gradient-to-r ${data.accent} px-4 py-3 text-white`}>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-white/15 p-2">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{data.label}</div>
            <div className="text-xs text-white/80">{data.subtitle}</div>
          </div>
        </div>
      </div>
      <div className="space-y-2 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.22em] text-[10px]">Node</span>
          <span className="font-medium text-foreground">{data.rawNode?.id}</span>
        </div>
        {data.locked && (
          <div className="rounded-lg border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
            System-locked structure
          </div>
        )}
        {hasError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-[11px] text-red-700">
            <div className="mb-1 flex items-center gap-1 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Validation
            </div>
            <div>{data.validationErrors[0]}</div>
          </div>
        )}
      </div>
      {isCondition ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} style={{ left: '28%' }} className="!bg-emerald-500" />
          <Handle id="false" type="source" position={Position.Bottom} style={{ left: '72%' }} className="!bg-rose-500" />
        </>
      ) : !isEnd ? (
        <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      ) : null}
    </div>
  );
}
