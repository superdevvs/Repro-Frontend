import { createContext, useContext } from 'react';
import type { ShootData } from '@/types/shoots';
import type { ApplyAlternateDateScope } from '@/services/shoots';

export type FetchShootsOptions = {
  includeFiles?: boolean;
};

export interface ShootsContextType {
  shoots: ShootData[];
  addShoot: (shoot: ShootData) => void;
  updateShoot: (
    shootId: string,
    updates: Partial<ShootData>,
    options?: { skipApi?: boolean },
  ) => Promise<void>;
  applyAlternateDate: (
    shootId: string,
    scope?: ApplyAlternateDateScope,
  ) => Promise<ShootData>;
  deleteShoot: (shootId: string) => void;
  getClientShootsByStatus: (status: string) => ShootData[];
  getUniquePhotographers: () => Array<{
    name: string;
    shootCount: number;
    avatar?: string;
  }>;
  getUniqueEditors: () => Array<{
    name: string;
    shootCount: number;
    avatar?: string;
  }>;
  getUniqueClients: () => Array<{
    name: string;
    email?: string;
    company?: string;
    phone?: string;
    shootCount: number;
  }>;
  fetchShoots: (
    signal?: AbortSignal,
    page?: number,
    perPage?: number,
    options?: FetchShootsOptions,
  ) => Promise<ShootData[]>;
  paginationMeta?: {
    currentPage: number;
    lastPage: number;
    total: number;
    perPage: number;
  };
}

export const ShootsContext = createContext<ShootsContextType | undefined>(
  undefined,
);

export const useOptionalShoots = () => useContext(ShootsContext);

export const useShoots = () => {
  const context = useContext(ShootsContext);
  if (!context) {
    throw new Error('useShoots must be used within a ShootsProvider');
  }
  return context;
};

