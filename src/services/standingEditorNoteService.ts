import { apiClient } from '@/services/api';
import {
  type ClientStandingEditorNotes,
  type CompanyMatchResult,
  type SaveStandingEditorNoteInput,
  type ShootStandingEditorNotes,
  type StandingEditorNoteRow,
  isRecord,
  parseShootStandingEditorNotes,
  parseStandingEditorNoteRow,
  parseStandingEditorNotes,
} from '@/utils/standingEditorNotes';

export * from '@/utils/standingEditorNotes';

const dataOf = (payload: unknown): unknown => (isRecord(payload) ? payload.data : undefined);

export async function listStandingEditorNotes(): Promise<StandingEditorNoteRow[]> {
  const response = await apiClient.get<unknown>('/standing-editor-notes');
  const data = dataOf(response.data);
  return Array.isArray(data) ? data.map(parseStandingEditorNoteRow).filter((row): row is StandingEditorNoteRow => row !== null) : [];
}

export async function fetchClientStandingEditorNotes(clientId: number | string): Promise<ClientStandingEditorNotes> {
  const response = await apiClient.get<unknown>('/standing-editor-notes', { params: { client_id: clientId } });
  const data = dataOf(response.data);
  if (!isRecord(data) || !isRecord(data.client)) {
    throw new Error('The standing editor note response was invalid. Please reload and try again.');
  }
  return {
    client: {
      id: Number(data.client.id),
      name: String(data.client.name ?? ''),
      company_name: typeof data.client.company_name === 'string' ? data.client.company_name : null,
    },
    client_note: parseStandingEditorNoteRow(data.client_note),
    applicable: parseStandingEditorNotes(data.applicable),
  };
}

export async function matchCompanyClients(company: string): Promise<CompanyMatchResult> {
  const response = await apiClient.get<unknown>('/standing-editor-notes/matches', { params: { company } });
  const data = dataOf(response.data);
  if (!isRecord(data)) return { count: 0, clients: [] };
  return {
    count: typeof data.count === 'number' ? data.count : 0,
    clients: Array.isArray(data.clients)
      ? data.clients.filter(isRecord).map((client) => ({
          id: Number(client.id),
          name: String(client.name ?? ''),
          company_name: typeof client.company_name === 'string' ? client.company_name : null,
        }))
      : [],
  };
}

const requireRow = (payload: unknown): StandingEditorNoteRow => {
  const row = parseStandingEditorNoteRow(dataOf(payload));
  if (!row) throw new Error('The standing editor note could not be saved. Please try again.');
  return row;
};

export async function createStandingEditorNote(input: SaveStandingEditorNoteInput): Promise<StandingEditorNoteRow> {
  const response = await apiClient.post<unknown>('/standing-editor-notes', input);
  return requireRow(response.data);
}

export async function updateStandingEditorNote(
  id: number,
  input: Partial<Pick<SaveStandingEditorNoteInput, 'company_match' | 'content' | 'is_active'>>,
): Promise<StandingEditorNoteRow> {
  const response = await apiClient.put<unknown>(`/standing-editor-notes/${id}`, input);
  return requireRow(response.data);
}

export async function deleteStandingEditorNote(id: number): Promise<void> {
  await apiClient.delete(`/standing-editor-notes/${id}`);
}

export async function setShootStandingEditorNotesHidden(
  shootId: number | string,
  hidden: boolean,
): Promise<ShootStandingEditorNotes | null> {
  const response = await apiClient.patch<unknown>(`/shoots/${shootId}/standing-editor-notes`, { hidden });
  return parseShootStandingEditorNotes(dataOf(response.data));
}
