import type { V4Workspace } from './types';

export function newestWorkspace(current: V4Workspace | null, next: V4Workspace): V4Workspace {
  return current?.id === next.id && (current.version ?? 0) > (next.version ?? 0) ? current : next;
}

/** Coalesce polling/manual refreshes; an earlier operation or route cannot publish a late response. */
export function createWorkspaceRefresh(options: {
  fetchWorkspace: (id: string) => Promise<V4Workspace>;
  currentScope: () => { id: string | null; epoch: number };
  onWorkspace: (workspace: V4Workspace) => void;
  onError: (error: unknown | null) => void;
}) {
  const pending = new Map<string, Promise<void>>();
  return (id: string): Promise<void> => {
    const epoch = options.currentScope().epoch;
    const key = `${epoch}:${id}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const isCurrent = () => { const scope = options.currentScope(); return scope.id === id && scope.epoch === epoch; };
    const request = Promise.resolve().then(() => options.fetchWorkspace(id)).then(workspace => {
      if (isCurrent()) { options.onWorkspace(workspace); options.onError(null); }
    }).catch(error => { if (isCurrent()) options.onError(error); }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
