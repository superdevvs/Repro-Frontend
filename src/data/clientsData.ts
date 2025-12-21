
import { Client } from '@/types/clients';

/**
 * Historical demo clients were removed so the dashboard only shows real data.
 * Start with an empty list; data will hydrate from the API/localStorage layer.
 */
export const initialClientsData: Client[] = [];

// Helper function to get clients data from localStorage or initial data
export const getClientsData = (): Client[] => {
  const storedClients = localStorage.getItem('clientsData');
  return storedClients ? JSON.parse(storedClients) : initialClientsData;
};
