import { describe, expect, it, vi } from 'vitest';
import type { V4Workspace } from './types';
import { createWorkspaceRefresh, newestWorkspace } from './workspaceRefresh';

const snapshot = (version: number, status: V4Workspace['status'] = 'generating') => ({ id: 'one', version, status } as V4Workspace);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('workspace refresh ordering', () => {
  it('coalesces polling and manual refresh while the same GET is pending', async () => {
    const response = deferred<V4Workspace>();
    const fetchWorkspace = vi.fn().mockReturnValue(response.promise);
    const onWorkspace = vi.fn();
    const refresh = createWorkspaceRefresh({ fetchWorkspace, currentScope: () => ({ id: 'one', epoch: 1 }), onWorkspace, onError: vi.fn() });
    const poll = refresh('one');
    const manual = refresh('one');
    expect(manual).toBe(poll);
    await Promise.resolve();
    expect(fetchWorkspace).toHaveBeenCalledTimes(1);
    response.resolve(snapshot(5, 'completed'));
    await poll;
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith(snapshot(5, 'completed'));
  });

  it('ignores a late running response after a newer operation has completed', async () => {
    const old = deferred<V4Workspace>(), next = deferred<V4Workspace>();
    const scope = { id: 'one', epoch: 1 };
    const onWorkspace = vi.fn(), onError = vi.fn();
    const fetchWorkspace = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const refresh = createWorkspaceRefresh({ fetchWorkspace, currentScope: () => scope, onWorkspace, onError });
    const oldRequest = refresh('one');
    await Promise.resolve();
    scope.epoch = 2;
    const newRequest = refresh('one');
    await Promise.resolve();
    next.resolve(snapshot(8, 'completed'));
    await newRequest;
    old.resolve(snapshot(6));
    await oldRequest;
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith(snapshot(8, 'completed'));
    expect(onError).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('does not publish an old-route error and permits a fresh request after failure', async () => {
    const old = deferred<V4Workspace>();
    const scope = { id: 'one', epoch: 1 };
    const onWorkspace = vi.fn(), onError = vi.fn();
    const fetchWorkspace = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(snapshot(9));
    const refresh = createWorkspaceRefresh({ fetchWorkspace, currentScope: () => scope, onWorkspace, onError });
    const pending = refresh('one');
    await Promise.resolve();
    scope.id = 'two';
    old.reject(new Error('Old request failed'));
    await pending;
    expect(onError).not.toHaveBeenCalled();
    scope.id = 'one';
    await refresh('one');
    expect(onWorkspace).toHaveBeenCalledExactlyOnceWith(snapshot(9));
  });

  it('never rolls a terminal snapshot backwards but accepts a newer explicit retry', () => {
    const completed = snapshot(8, 'completed');
    expect(newestWorkspace(completed, snapshot(7))).toBe(completed);
    expect(newestWorkspace(completed, snapshot(9))).toEqual(snapshot(9));
  });
});
