import { apiClient } from './api';
import { saveStudioBlob, studioImageBlob } from './listingStudioClientService';
import type { StudioRevisionAssignees, StudioRevisionPage, StudioRevisionReason, StudioRevisionTask } from '@/types/listingStudioTeam';

interface Envelope<T> { success: boolean; data: T }
const root = '/listing-studio/team/revisions';
const taskPath = (id: string) => `${root}/${encodeURIComponent(id)}`;
const keyed = (key: string) => ({ headers: { 'Idempotency-Key': key } });
type TaskResult = { task: StudioRevisionTask; created?: boolean };
export const listingStudioTeam = {
  async list(page = 1, status = '') { return (await apiClient.get<Envelope<StudioRevisionPage>>(root, { params: { page, perPage: 20, ...(status ? { status } : {}) } })).data.data; },
  async detail(id: string) { return (await apiClient.get<Envelope<TaskResult>>(taskPath(id))).data.data.task; },
  async assignees(id: string) { return (await apiClient.get<Envelope<StudioRevisionAssignees>>(`${taskPath(id)}/assignees`)).data.data; },
  async assign(id: string, assigneeId: string | null, expectedVersion: number, key: string) { return (await apiClient.patch<Envelope<TaskResult>>(`${taskPath(id)}/assignment`, { assigneeId, expectedVersion }, keyed(key))).data.data.task; },
  async start(id: string, expectedVersion: number, key: string) { return (await apiClient.post<Envelope<TaskResult>>(`${taskPath(id)}/start`, { expectedVersion }, keyed(key))).data.data.task; },
  async deliver(id: string, photo: File, expectedVersion: number, key: string) {
    const form = new FormData(); form.append('photo', photo); form.append('expectedVersion', String(expectedVersion));
    return (await apiClient.post<Envelope<TaskResult>>(`${taskPath(id)}/deliver`, form, keyed(key))).data.data;
  },
  async resume(id: string, attemptId: string, expectedVersion: number, key: string) { return (await apiClient.post<Envelope<TaskResult>>(`${taskPath(id)}/delivery-attempts/${encodeURIComponent(attemptId)}/resume`, { expectedVersion }, keyed(key))).data.data.task; },
  async transition(id: string, action: 'hold' | 'fail' | 'cancel', expectedVersion: number, reasonCode: StudioRevisionReason, note: string, key: string) { return (await apiClient.post<Envelope<TaskResult>>(`${taskPath(id)}/${action}`, { expectedVersion, reasonCode, note }, keyed(key))).data.data.task; },
  preview(id: string, variant: 'original' | 'result' | 'delivery', signal?: AbortSignal) { return studioImageBlob(`${taskPath(id)}/preview`, { variant }, signal); },
  async downloadSource(id: string, variant: 'original' | 'result') { saveStudioBlob(await studioImageBlob(`${taskPath(id)}/source`, { variant }), `studio-revision-${variant}`); },
};
