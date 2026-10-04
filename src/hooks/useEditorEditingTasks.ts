import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
import { readShootListPages } from '@/utils/readShootListPages';

export interface EditorTaskSummary {
  id: string;
  shoot_id: number;
  address: string;
  scope: string;
  status: string;
  pending_items_count: number;
}

export function useEditorEditingTasks(editorId: string | number | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['editor-editing-tasks', editorId],
    enabled: enabled && Boolean(editorId),
    queryFn: async ({ signal }) => {
      const readPage = async (page: number) => {
        const { data } = await apiClient.get<{ data: EditorTaskSummary[]; last_page: number }>('/editing-tasks', {
          signal, params: { page, open: true, summary: true },
        });
        return { data: data.data, meta: { last_page: data.last_page } };
      };
      const result = await readShootListPages(await readPage(1), readPage, { signal });
      return result.data ?? [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });
}
