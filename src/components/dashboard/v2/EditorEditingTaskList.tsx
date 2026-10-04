import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditingTasks } from '@/components/shoots/EditingTasks';
import type { EditorTaskSummary } from '@/hooks/useEditorEditingTasks';

export function EditorEditingTaskList({ tasks, isLoading, isError, onRefresh }: {
  tasks: EditorTaskSummary[]; isLoading: boolean; isError: boolean; onRefresh: () => void;
}) {
  const [selectedShoot, setSelectedShoot] = useState<number | null>(null);
  const shoots = new Map<number, { address: string; count: number; requests: number }>();
  for (const task of tasks) {
    const previous = shoots.get(task.shoot_id);
    shoots.set(task.shoot_id, { address: task.address, count: (previous?.count ?? 0) + task.pending_items_count,
      requests: (previous?.requests ?? 0) + 1 });
  }
  return <section id="editor-assigned-tasks" aria-label="Shoots sent to you" className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">Sent to you {shoots.size > 0 && <span className="ml-1 rounded bg-primary/10 px-2 py-0.5 text-primary">{shoots.size}</span>}</h3>
      <Button size="sm" variant="ghost" onClick={onRefresh}>Refresh</Button>
    </div>
    {isLoading && <p role="status" className="text-sm text-muted-foreground">Loading editing assignments…</p>}
    {isError && <p role="alert" className="text-sm text-destructive">Could not load editing assignments. Try Refresh.</p>}
    {Array.from(shoots, ([id, shoot]) => <article key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{shoot.address || `Shoot #${id}`}</p>
        <p className="mt-1 text-xs text-muted-foreground">Shoot #{id} · {shoot.count} media {shoot.count === 1 ? 'task' : 'tasks'} · {shoot.requests} {shoot.requests === 1 ? 'request' : 'requests'}</p>
      </div>
      <Button size="sm" onClick={() => setSelectedShoot(id)} aria-label={`Open editing tasks for ${shoot.address || `shoot ${id}`}`}>Open tasks<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>
    </article>)}
    {selectedShoot !== null && <EditingTasks key={selectedShoot} shootId={selectedShoot} open onOpenChange={open => {
      if (!open) { setSelectedShoot(null); onRefresh(); }
    }} hideTrigger onTasksChanged={onRefresh} />}
  </section>;
}
