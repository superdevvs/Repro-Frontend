import { createContext, useContext } from 'react';

export type EditingSource = 'all' | 'shoots' | 'studio';
interface StudioRevisionRequestsState {
  enabled: boolean;
  accountId: string;
  accessKey: string;
  activeCount: number;
  countError: boolean;
  source: EditingSource;
  setSource: (source: EditingSource) => void;
  selectedTaskId: string | null;
  openTask: (id: string) => void;
  clearTask: () => void;
  refreshCount: () => void;
}
const noop = () => {};
export const StudioRevisionRequestsContext = createContext<StudioRevisionRequestsState>({
  enabled: false, accountId: '', accessKey: '', activeCount: 0, countError: false,
  source: 'all', setSource: noop, selectedTaskId: null, openTask: noop, clearTask: noop, refreshCount: noop,
});
export const useStudioRevisionRequests = () => useContext(StudioRevisionRequestsContext);
