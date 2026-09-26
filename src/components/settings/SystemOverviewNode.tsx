import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { FlowNode, FlowNodeData } from './systemOverviewFlowTypes';

const kindStyles: Record<FlowNodeData['kind'], string> = {
  domain: 'border-border bg-card text-card-foreground',
  page: 'border-primary/30 bg-primary/10 text-card-foreground',
  component: 'border-border bg-muted/70 text-card-foreground',
  api: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-950 dark:text-emerald-50',
  service: 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-50',
  external: 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-950 dark:text-fuchsia-50',
};

export default function SystemOverviewNode({ data, selected }: NodeProps<FlowNode>) {
  const sizeClass = data.kind === 'domain' ? 'h-[196px] w-[300px]' : data.kind === 'page' ? 'h-[184px] w-[248px]' : 'h-[180px] w-[216px]';
  const metricGridClass = data.kind === 'domain' ? 'gap-2 text-[11px]' : 'gap-1.5 text-[10px]';
  const metricPadClass = data.kind === 'domain' ? 'px-2 py-2' : 'px-2 py-1.5';

  return (
    <div
      className={`${sizeClass} rounded-2xl border p-3 shadow-sm transition-shadow ${kindStyles[data.kind]} ${
        selected ? 'shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-primary" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wide opacity-70">{data.kind}</div>
          <div className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-5" title={data.label}>{data.label}</div>
          <div className="mt-1 line-clamp-2 break-words text-xs leading-5 opacity-75" title={data.description || data.domain}>{data.description || data.domain}</div>
        </div>
        {(data.activeUsers || 0) > 0 && (
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-foreground/10 px-2 py-1 text-[11px]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
            {data.activeUsers}
          </div>
        )}
      </div>
      <div className={`mt-3 grid grid-cols-3 ${metricGridClass}`}>
        <div className={`min-w-0 rounded-xl ${metricPadClass} bg-foreground/5`}>
          <div className="opacity-60">Req</div>
          <div className="truncate font-semibold tabular-nums">{data.requests ?? 0}</div>
        </div>
        <div className={`min-w-0 rounded-xl ${metricPadClass} bg-foreground/5`}>
          <div className="opacity-60">Err</div>
          <div className="truncate font-semibold tabular-nums">{data.errors ?? 0}</div>
        </div>
        <div className={`min-w-0 rounded-xl ${metricPadClass} bg-foreground/5`}>
          <div className="opacity-60">Avg</div>
          <div className="truncate font-semibold tabular-nums">{data.avgDurationMs ?? 0}ms</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-primary" />
    </div>
  );
}
