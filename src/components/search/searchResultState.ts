import type { SearchResult } from './searchTypes';

/** Use the dashboard's existing request modals; selecting a search result performs no mutation. */
export function searchResultState(result: SearchResult) {
  if (result.type === 'requests') return { openRequestManager: true, selectedRequestId: result.id };
  if (result.type === 'editing-requests') return { openEditingRequest: true, editingRequestId: Number(result.id) };
  return undefined;
}
