import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEditorEditingTasks } from './useEditorEditingTasks';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: mocks }));
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
beforeEach(() => { mocks.get.mockReset(); });
afterEach(cleanup);

it('loads every pending task page independently of legacy shoot assignments', async () => {
  mocks.get.mockImplementation(async (_url, { params }) => ({ data: {
    data: [{ id: `dispatch-${params.page}`, shoot_id: params.page, pending_items_count: 5 }], last_page: 2,
  } }));
  const { result } = renderHook(() => useEditorEditingTasks(999, true), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.map(task => task.shoot_id)).toEqual([1, 2]);
  expect(mocks.get).toHaveBeenCalledWith('/editing-tasks', expect.objectContaining({ params: { page: 2, open: true, summary: true } }));
});

it('does not request assignments when the viewer is not an editor', () => {
  renderHook(() => useEditorEditingTasks(9, false), { wrapper });
  expect(mocks.get).not.toHaveBeenCalled();
});
