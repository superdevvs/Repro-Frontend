export interface ServiceGroupSummary {
  id: string;
  name: string;
  description?: string | null;
}

export interface ServiceGroupServiceSummary {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
  } | null;
}

export interface ServiceGroupClientSummary {
  id: string;
  name: string;
  email: string;
  company?: string | null;
}

export interface ServiceGroupDetail extends ServiceGroupSummary {
  is_active: boolean;
  services: ServiceGroupServiceSummary[];
  clients: ServiceGroupClientSummary[];
  service_ids: string[];
  client_ids: string[];
  service_count: number;
  client_count: number;
  created_at?: string;
  updated_at?: string;
}
