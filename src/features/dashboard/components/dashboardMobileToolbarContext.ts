import { createContext } from 'react';

/** Active role-dashboard card actions can share the compact tab row. */
export const DashboardMobileToolbarContext = createContext<HTMLDivElement | null>(null);
