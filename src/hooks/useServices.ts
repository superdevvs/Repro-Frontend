
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import API_ROUTES from '@/lib/api';
import type { ServiceGroupSummary } from '@/types/serviceGroups';
import type { UserRole } from '@/types/auth';

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
  exclude_from_sales_commission?: boolean;
  service_categories?: {
    id: string;
    name: string;
  };
  service_groups?: ServiceGroupSummary[];
  service_group_ids?: string[];
};

type UseServicesScope = 'auto' | 'public' | 'admin';

interface UseServicesOptions {
  scope?: UseServicesScope;
}

const ADMIN_SERVICE_CATALOG_ROLES = new Set<UserRole>([
  'admin',
  'superadmin',
  'editing_manager',
]);

export const useServices = ({ scope = 'auto' }: UseServicesOptions = {}) => {
  const { role } = useAuth();
  const preferAdminCatalog =
    scope === 'admin' || (scope === 'auto' && ADMIN_SERVICE_CATALOG_ROLES.has(role));

  return useQuery({
    queryKey: ['services', scope, role],
    queryFn: async () => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const headers = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      let response: Response | null = null;

      if (token && preferAdminCatalog) {
        response = await fetch(API_ROUTES.services.adminAll, { headers });
      }

      if (!response || !response.ok) {
        response = await fetch(API_ROUTES.services.all, { headers });
      }

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
        exclude_from_sales_commission: Boolean(item.exclude_from_sales_commission),
        service_categories: item.category
          ? {
              id: String(item.category.id),
              name: item.category.name,
            }
          : undefined,
        service_groups: Array.isArray(item.service_groups)
          ? item.service_groups.map((group: any) => ({
              id: String(group.id),
              name: group.name,
              description: group.description ?? '',
            }))
          : undefined,
        service_group_ids: Array.isArray(item.service_group_ids)
          ? item.service_group_ids.map((id: any) => String(id))
          : undefined,
      }));
    },
  });
};
