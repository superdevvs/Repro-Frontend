import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/env';

export const useServiceCategories = () => {
  return useQuery({
    queryKey: ['serviceCategories'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/categories`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch service categories');
      }

      const data = await response.json();
      console.log('Fetched service categories:', data);
      return data;
    }
  });
};
