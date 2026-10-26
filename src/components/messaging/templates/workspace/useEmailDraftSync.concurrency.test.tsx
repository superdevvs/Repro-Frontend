import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailServerDraft } from '@/types/emailTemplateWorkspace';
import { startingEmail } from './emailWorkspaceModel';
import { useEmailDraftSync } from './useEmailDraftSync';

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('@/services/emailWorkspaceV2', () => ({ loadEmailServerDraft: api.load, saveEmailServerDraft: api.save, deleteEmailServerDraft: api.remove }));

const draft = startingEmail('tips');
const saved: EmailServerDraft = { id: '550e8400-e29b-41d4-a716-446655440000', revision: 2, draft };
const conflict = { response: { status: 409 } };
async function settle() { await act(async () => { await Promise.resolve(); }); }

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); api.load.mockResolvedValue(null); api.remove.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('server draft concurrency and recovery', () => {
  it('stops a competing first save and can reload the canonical server draft', async () => {
    let winner: EmailServerDraft | null = null;
    api.save.mockImplementation(async (id, revision, value) => {
      if (winner && id !== winner.id) throw conflict;
      winner = { id, revision: revision + 1, draft: value };
      return { id, revision: revision + 1 };
    });
    const first = renderHook(() => useEmailDraftSync(84, draft, true, true, false));
    const second = renderHook(({ value }) => useEmailDraftSync(84, value, true, true, false), { initialProps: { value: draft } });
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(first.result.current.status).toBe('Draft saved');
    expect(second.result.current.status).toContain('another tab');
    second.rerender({ value: { ...draft, subject: 'Keep this local edit' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2400); });
    expect(api.save).toHaveBeenCalledTimes(2);
    api.load.mockResolvedValue(winner);
    await act(async () => { await second.result.current.reload(); });
    expect(second.result.current.recovery).toEqual(winner);
  });

  it('clears only the known server revision and retains recovery after a conflict', async () => {
    api.load.mockResolvedValue(saved); api.remove.mockRejectedValueOnce(conflict);
    const hook = renderHook(() => useEmailDraftSync(84, draft, false, true, false));
    await settle();
    await act(async () => { await expect(hook.result.current.clear()).rejects.toEqual(conflict); });
    expect(api.remove).toHaveBeenLastCalledWith(saved.id, 2);
    expect(hook.result.current.recovery).toEqual(saved);
    expect(hook.result.current.status).toContain('another tab');
    api.load.mockResolvedValue({ ...saved, revision: 3 });
    await act(async () => { await hook.result.current.reload(); });
    await act(async () => { await hook.result.current.clear(); });
    expect(api.remove).toHaveBeenLastCalledWith(saved.id, 3);
    expect(hook.result.current.recovery).toBeNull();
  });

  it('waits for recovery loading before an explicit save clears the draft', async () => {
    let resolve!: (value: EmailServerDraft) => void;
    api.load.mockReturnValue(new Promise<EmailServerDraft>(done => { resolve = done; }));
    const hook = renderHook(() => useEmailDraftSync(84, draft, false, true, false));
    let clearing!: Promise<void>;
    act(() => { clearing = hook.result.current.clear(); });
    expect(api.remove).not.toHaveBeenCalled();
    await act(async () => { resolve(saved); await clearing; });
    expect(api.remove).toHaveBeenCalledWith(saved.id, saved.revision);
    expect(hook.result.current.recovery).toBeNull();
  });

  it('ignores a late reload after the workspace changes', async () => {
    let finishOldReload!: (value: EmailServerDraft) => void;
    const other = { ...saved, id: '550e8400-e29b-41d4-a716-446655440001', revision: 1 };
    api.load.mockResolvedValueOnce(saved)
      .mockImplementationOnce(() => new Promise<EmailServerDraft>(resolve => { finishOldReload = resolve; }))
      .mockResolvedValueOnce(other);
    const hook = renderHook(({ id }) => useEmailDraftSync(id, draft, false, true, false), { initialProps: { id: 84 } });
    await settle();
    let reloading!: Promise<void>;
    act(() => { reloading = hook.result.current.reload(); });
    hook.rerender({ id: 85 }); await settle();
    expect(hook.result.current.recovery).toEqual(other);
    await act(async () => { finishOldReload(saved); await reloading; });
    expect(hook.result.current.recovery).toEqual(other);
  });
});
