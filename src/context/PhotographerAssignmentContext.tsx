import React, { createContext, useContext, useState, useCallback } from 'react';
import { DashboardPhotographerSummary } from '@/types/dashboard';

interface PhotographerAssignmentContextType {
  isOpen: boolean;
  photographer: DashboardPhotographerSummary | null;
  openModal: (photographer: DashboardPhotographerSummary) => void;
  closeModal: () => void;
}

const PhotographerAssignmentContext = createContext<PhotographerAssignmentContextType | undefined>(undefined);

export const PhotographerAssignmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [photographer, setPhotographer] = useState<DashboardPhotographerSummary | null>(null);

  const openModal = useCallback((photographerData: DashboardPhotographerSummary) => {
    setPhotographer(photographerData);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setPhotographer(null);
  }, []);

  return (
    <PhotographerAssignmentContext.Provider
      value={{
        isOpen,
        photographer,
        openModal,
        closeModal,
      }}
    >
      {children}
    </PhotographerAssignmentContext.Provider>
  );
};

export const usePhotographerAssignment = () => {
  const context = useContext(PhotographerAssignmentContext);
  if (context === undefined) {
    throw new Error('usePhotographerAssignment must be used within a PhotographerAssignmentProvider');
  }
  return context;
};


