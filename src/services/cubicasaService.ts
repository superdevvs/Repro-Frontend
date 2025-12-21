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

export const cubicasaService = {
  /**
   * Create a new scan order
   */
  async createOrder(data: CreateOrderData): Promise<CubiCasaOrder> {
    const response = await apiClient.post(API_ROUTES.cubicasa.createOrder, data);
    return response.data;
  },

  /**
   * Get list of orders
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
    return response.data;
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
