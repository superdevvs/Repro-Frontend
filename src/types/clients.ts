
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
  status: 'active' | 'inactive';
  shootsCount: number;
  lastActivity: string;
  avatar?: string;
  rep?: string;
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
