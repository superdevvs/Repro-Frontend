import { apiClient } from '@/services/api';

export type CubicasaTrackedShoot = {
  id: number;
  address: string;
  scheduled_at?: string | null;
  client_name?: string | null;
  photographer_name?: string | null;
  services: string[];
  cubicasa_order_id?: string | null;
  cubicasa_external_id?: string | null;
  cubicasa_status?: string | null;
  cubicasa_sync_status?: string | null;
  cubicasa_last_sync_error?: string | null;
  cubicasa_tour_url?: string | null;
  linked: boolean;
};

export type CubicasaShootList = {
  data: CubicasaTrackedShoot[];
  counts: { missing: number; linked: number };
};

export async function getCubicasaTrackedShoots(params: {
  status: 'missing' | 'linked' | 'all';
  search?: string;
}): Promise<CubicasaShootList> {
  const response = await apiClient.get('/cubicasa/shoots', {
    params: {
      status: params.status,
      search: params.search || undefined,
    },
  });
  return response.data;
}

export async function createCubicasaOrder(shootId: number) {
  const response = await apiClient.post(`/integrations/shoots/${shootId}/cubicasa/order`);
  return response.data;
}
