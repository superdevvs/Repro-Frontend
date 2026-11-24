import { createContext, useContext, useEffect } from 'react';

export interface RobbieWhere {
  page: string;
  entityType?: 'crm_contact';
  entityId?: number;
  label?: string;
}

export interface CrmRobbieValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  where: RobbieWhere;
  setWhere: (where: RobbieWhere) => void;
  /** A question waiting to be sent when the panel opens (from the strip, a button or plan my day). */
  pending: string | null;
  ask: (prompt: string) => void;
  clearPending: () => void;
}

export const CrmRobbieContext = createContext<CrmRobbieValue | null>(null);

export const useCrmRobbie = () => useContext(CrmRobbieContext);

/** Pages call this so Robbie knows where the user is ("this contact"). */
export function useRobbieWhere(where: RobbieWhere) {
  const robbie = useCrmRobbie();
  const key = `${where.page}:${where.entityType ?? ''}:${where.entityId ?? ''}:${where.label ?? ''}`;
  useEffect(() => {
    robbie?.setWhere(where);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
