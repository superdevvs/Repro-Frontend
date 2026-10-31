import { apiClient } from './api';

export type ListingStudioTrialService = 'staging' | 'decluttering' | 'grass' | 'twilight';
export interface ListingStudioTrial {
  id: string;
  service: ListingStudioTrialService;
  status: string;
  progress: number | null;
  previewAvailable: boolean;
  downloadAvailable: boolean;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  error: string | null;
  errorCode: string | null;
}

interface TrialsResponse { success: boolean; data: { trials: ListingStudioTrial[] } }
const TRIALS_PATH = '/listing-studio/trials';

export async function claimListingStudioTrials(token: string): Promise<ListingStudioTrial[]> {
  return (await apiClient.post<TrialsResponse>(`${TRIALS_PATH}/claim`, { token })).data.data.trials;
}

export async function getListingStudioTrials(): Promise<ListingStudioTrial[]> {
  return (await apiClient.get<TrialsResponse>(TRIALS_PATH)).data.data.trials;
}

export async function downloadListingStudioTrial(trial: Pick<ListingStudioTrial, 'id' | 'service'>): Promise<void> {
  let file: Blob;
  try {
    file = (await apiClient.get<Blob>(`${TRIALS_PATH}/${encodeURIComponent(trial.id)}/download`, {
      responseType: 'blob', headers: { Accept: 'image/jpeg, image/png, image/webp' },
    })).data;
  } catch (error) {
    // Axios returns a Blob even for JSON errors on a download request.
    const response = (error as { response?: { data?: unknown } })?.response;
    if (response?.data instanceof Blob && response.data.type.includes('json')) {
      try { response.data = JSON.parse(await response.data.text()); } catch { /* Keep the normal error fallback. */ }
    }
    throw error;
  }
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  if (!extension || file.size === 0) throw new Error('The edited photo is not available.');
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `listing-studio-${trial.service}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the private blob.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
