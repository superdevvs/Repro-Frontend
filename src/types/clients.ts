
import type { ServiceGroupSummary } from '@/types/serviceGroups';
import type { ClientDiscountType, EmailHealth } from '@/types/auth';

/**
 * Client type definition
 */
export interface Client {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  zip?: string;
  licenseNumber?: string;
  status: 'active' | 'inactive';
  shootsCount: number;
  lastActivity: string;
  avatar?: string;
  rep?: string;
  companyNotes?: string;
  service_groups?: ServiceGroupSummary[];
  service_group_ids?: string[];
  shootCcEmails?: string[];
  shoot_cc_emails?: string[];
  clientDiscountType?: ClientDiscountType;
  client_discount_type?: ClientDiscountType;
  clientDiscountValue?: number | null;
  client_discount_value?: number | null;
  email_health?: EmailHealth;
}

/**
 * Account type definition
 */
export interface Account {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  type: 'admin' | 'photographer' | 'client' | 'editor' | 'superadmin';
  shootsCount: number;
  status: 'active' | 'inactive';
  avatar?: string;
}
