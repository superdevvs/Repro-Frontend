import { apiClient } from './api';
import { API_ROUTES } from '@/lib/api';

export interface CubiCasaOrder {
  id: string;
  address: string;
  property_type?: string;
  status?: string;
  floor_plan_url?: string;
  result_url?: string;
  created_at?: string;
  updated_at?: string;
  shoot_id?: number;
  notes?: string;
}

export interface CreateOrderData {
  address: string;
  property_type?: string;
  shoot_id?: number;
  notes?: string;
  customer_name?: string;
  customer_email?: string;
}

export interface OrderStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export interface UploadResult {
  filename: string;
  status: 'uploaded' | 'failed';
  error?: string;
  response?: any;
}

/**
 * Map a raw CubiCasa Integrate API v3 status (e.g. "Pending", "Ready",
 * "InProgress") onto the canonical buckets the UI filters and colors by.
 */
function normalizeStatus(raw?: string): CubiCasaOrder['status'] {
  const value = (raw ?? '').toLowerCase();
  switch (value) {
    case 'ready':
    case 'delivered':
    case 'completed':
    case 'complete':
      return 'completed';
    case 'inprogress':
    case 'in_progress':
    case 'processing':
    case 'scanning':
      return 'processing';
    case 'failed':
    case 'error':
    case 'cancelled':
    case 'canceled':
      return 'failed';
    case 'pending':
    case 'draft':
    case 'new':
    case '':
      return 'pending';
    default:
      return value;
  }
}

/**
 * Convert a CubiCasa epoch timestamp (seconds, possibly fractional) into an ISO
 * string the UI's date formatter understands. Returns undefined when absent.
 */
function epochToIso(seconds?: number | null): string | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Normalize a raw CubiCasa Integrate API v3 order (nested info/address) into the
 * flat {@link CubiCasaOrder} shape the dashboard UI renders.
 */
function normalizeOrder(raw: any): CubiCasaOrder {
  if (!raw || typeof raw !== 'object') {
    return { id: '', address: '' };
  }

  // Already-flat payloads (e.g. our own createOrder response) pass through.
  const info = raw.info && typeof raw.info === 'object' ? raw.info : null;
  const address = raw.address && typeof raw.address === 'object' ? raw.address : null;
  if (!info && !address) {
    return raw as CubiCasaOrder;
  }

  const externalId: string | undefined = info?.external_id ?? undefined;
  const shootMatch = typeof externalId === 'string' ? externalId.match(/^shoot-(\d+)$/) : null;

  return {
    id: String(raw.id ?? ''),
    address: address?.full_address ?? info?.location ?? '',
    property_type: info?.order_type ?? undefined,
    status: normalizeStatus(info?.status),
    created_at: epochToIso(info?.created_at),
    updated_at: epochToIso(info?.first_delivered_at),
    shoot_id: shootMatch ? Number(shootMatch[1]) : undefined,
  };
}

export const cubicasaService = {
  /**
   * Create a new scan order
   */
  async createOrder(data: CreateOrderData): Promise<CubiCasaOrder> {
    const response = await apiClient.post(API_ROUTES.cubicasa.createOrder, data);
    return normalizeOrder(response.data);
  },

  /**
   * Get list of orders.
   *
   * The CubiCasa Integrate API v3 `GET /orders` response is an object of the
   * shape `{ pagination, items: [...] }`, and each item nests its fields under
   * `info`/`address`. We unwrap `items` and normalize each entry into the flat
   * {@link CubiCasaOrder} shape the UI consumes.
   */
  async getOrders(filters?: {
    shoot_id?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<CubiCasaOrder[]> {
    const params = new URLSearchParams();
    if (filters?.shoot_id) params.append('shoot_id', filters.shoot_id.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const url = `${API_ROUTES.cubicasa.listOrders}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);

    const payload = response.data;
    const items: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

    return items.map(normalizeOrder);
  },

  /**
   * Get order details
   */
  async getOrder(id: string | number): Promise<CubiCasaOrder> {
    const response = await apiClient.get(API_ROUTES.cubicasa.getOrder(id));
    return response.data;
  },

  /**
   * Upload photos for an order
   */
  async uploadPhotos(orderId: string | number, photos: File[]): Promise<{ order_id: string; uploads: UploadResult[] }> {
    const formData = new FormData();
    photos.forEach((photo) => {
      formData.append('photos[]', photo);
    });

    const response = await apiClient.post(
      API_ROUTES.cubicasa.uploadPhotos(orderId),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Get order status
   */
  async getOrderStatus(id: string | number): Promise<OrderStatus> {
    const response = await apiClient.get(API_ROUTES.cubicasa.getOrderStatus(id));
    return response.data;
  },

  /**
   * Link order to shoot
   */
  async linkToShoot(orderId: string | number, shootId: number): Promise<{ message: string; shoot_id: number; order_id: string }> {
    const response = await apiClient.post(API_ROUTES.cubicasa.linkToShoot(orderId), {
      shoot_id: shootId,
    });
    return response.data;
  },
};
