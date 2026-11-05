import { apiClient } from '@/services/api';

export interface BrokerageLogo {
  logo: string | null;
  can_manage: boolean;
}

const endpoint = (userId: string | number) => `/users/${encodeURIComponent(userId)}/brokerage-logo`;

export async function getBrokerageLogo(userId: string | number): Promise<BrokerageLogo> {
  const { data } = await apiClient.get<{ data: BrokerageLogo }>(endpoint(userId));
  return data.data;
}

export async function saveBrokerageLogo(userId: string | number, file: File | null): Promise<BrokerageLogo> {
  if (!file) {
    const { data } = await apiClient.delete<{ data: BrokerageLogo }>(endpoint(userId));
    return data.data;
  }

  const body = new FormData();
  body.append('logo', file);
  const { data } = await apiClient.post<{ data: BrokerageLogo }>(endpoint(userId), body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export function validateBrokerageLogo(file: File): string | null {
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return 'Choose a PNG or JPG image.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'The logo must be 5 MB or smaller.';
  }
  return null;
}
