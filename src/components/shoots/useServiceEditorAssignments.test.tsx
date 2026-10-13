import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useServiceEditorAssignments } from './useServiceEditorAssignments';
import { loadShootAssignees } from '@/services/shootAssignees';
vi.mock('@/services/shootAssignees', async original => ({
  ...await original<typeof import('@/services/shootAssignees')>(), loadShootAssignees: vi.fn(async () => []),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('service editor drafts', () => {
  it('hydrates existing per-service editors, keeps new services empty, and clears explicitly', async () => {
    const shoot = { id: '2407', serviceItems: [{ service_id: '1', editor_id: 8, editor: { id: 8, name: 'Photo Editor' } }] };
    const { result, rerender } = renderHook(({ active }) => useServiceEditorAssignments(shoot, active, true), { initialProps: { active: true } });
    await waitFor(() => expect(result.current.isLoadingEditors).toBe(false));
    expect(result.current.serviceEditorIds['1']).toBe('8');
    expect(result.current.serviceEditorIds['51']).toBeUndefined();
    act(() => result.current.updateServiceEditor('1', ''));
    act(() => result.current.updateServiceEditor('51', '9'));
    expect(result.current.serviceEditorChanges).toEqual({ '1': '', '51': '9' });
    rerender({ active: false });
    expect(result.current.serviceEditorChanges).toEqual({});
  });
  it('does not load or change editors without assignment permission', () => {
    const { result } = renderHook(() => useServiceEditorAssignments({ id: '2407' }, true, false));
    act(() => result.current.updateServiceEditor('51', '8'));
    expect(result.current.serviceEditorChanges).toEqual({});
    expect(loadShootAssignees).not.toHaveBeenCalled();
  });
});
