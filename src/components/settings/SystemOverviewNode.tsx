import { Handle, Position, type NodeProps } from '@xyflow/react';

import { useTheme } from '@/hooks/useTheme';

import type { FlowNode, FlowNodeData } from './systemOverviewFlowTypes';

export default function SystemOverviewNode({ data, selected }: NodeProps<FlowNode>) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const sizeClass = data.kind === 'domain' ? 'w-[300px]' : data.kind === 'page' ? 'w-[268px]' : 'w-[220px]';
  const metricGridClass = data.kind === 'domain' ? 'gap-2 text-[11px]' : 'gap-1.5 text-[10px]';
  const metricPadClass = data.kind === 'domain' ? 'px-2 py-2' : 'px-2 py-1.5';
  const kindStyles: Record<FlowNodeData['kind'], string> = isDark
    ? {
        domain: 'border-sky-400/30 bg-slate-950/95 text-slate-50',
        page: 'border-sky-300/25 bg-slate-900/95 text-slate-50',
        component: 'border-slate-700/80 bg-slate-900/80 text-slate-100',
        api: 'border-emerald-400/25 bg-emerald-950/60 text-emerald-50',
        service: 'border-amber-400/25 bg-amber-950/60 text-amber-50',
        external: 'border-fuchsia-400/25 bg-fuchsia-950/60 text-fuchsia-50',
      }
    : {
        domain: 'border-slate-300 bg-white/95 text-slate-950',
        page: 'border-sky-200 bg-sky-50/90 text-slate-950',
        component: 'border-slate-200 bg-white text-slate-900',
        api: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
        service: 'border-amber-200 bg-amber-50/90 text-amber-950',
        external: 'border-fuchsia-200 bg-fuchsia-50/90 text-fuchsia-950',
      };
  const metricTone = isDark ? 'bg-white/5' : 'bg-slate-950/5';

  return (
    <div
      className={`${sizeClass} rounded-3xl border p-3 shadow-lg transition-all backdrop-blur-sm ${kindStyles[data.kind]} ${
        selected ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-background' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-sky-400" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] opacity-70">{data.kind}</div>
          <div className="mt-1 text-sm font-semibold break-words">{data.label}</div>
          <div className="mt-1 text-xs opacity-75 break-words">{data.description || data.domain}</div>
        </div>
        {(data.activeUsers || 0) > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {data.activeUsers}
          </div>
        )}
      </div>
      <div className={`mt-3 grid grid-cols-3 ${metricGridClass}`}>
        <div className={`rounded-2xl ${metricPadClass} ${metricTone}`}>
          <div className="opacity-60">Req</div>
          <div className="font-semibold">{data.requests ?? 0}</div>
        </div>
        <div className={`rounded-2xl ${metricPadClass} ${metricTone}`}>
          <div className="opacity-60">Err</div>
          <div className="font-semibold">{data.errors ?? 0}</div>
        </div>
        <div className={`rounded-2xl ${metricPadClass} ${metricTone}`}>
          <div className="opacity-60">Avg</div>
          <div className="font-semibold">{data.avgDurationMs ?? 0}ms</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-400" />
    </div>
  );
}

