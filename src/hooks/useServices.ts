
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';

export type Service = {
  id: string;
  name: string;
  description?: string;
  price: number;
  delivery_time?: number;
  active: boolean;
  category?: string;
  category_id?: string;
  icon?: string;
  photographer_required?: boolean;
  service_categories?: {
    id: string;
    name: string;
  };
};

export const useServices = () => {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/services`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load services');
      }

      const json = await response.json();
      const records = Array.isArray(json.data) ? json.data : json;

      return records.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        description: item.description || '',
        price: Number(item.price ?? 0),
        delivery_time: item.delivery_time ?? item.duration ?? null,
        active: item.is_active ?? true,
        category: item.category?.name || item.category_name || '',
        category_id: item.category_id ? String(item.category_id) : undefined,
        icon: item.icon,
        photographer_required: Boolean(item.photographer_required),
        service_categories: item.category
          ? {
              id: String(item.category.id),
              name: item.category.name,
            }
          : undefined,
      }));
    },
  });
};
