import React, { createContext, useContext, useState, useCallback } from 'react';
import { DashboardClientRequest } from '@/types/dashboard';

interface IssueManagerContextType {
  isOpen: boolean;
  requests: DashboardClientRequest[];
  selectedRequestId: string | null;
  openModal: (requests: DashboardClientRequest[], selectedRequestId?: string | null) => void;
  closeModal: () => void;
  selectRequest: (requestId: string | null) => void;
}

const IssueManagerContext = createContext<IssueManagerContextType | undefined>(undefined);

export const IssueManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<DashboardClientRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const openModal = useCallback((newRequests: DashboardClientRequest[], selectedId?: string | null) => {
    setRequests(newRequests);
    setSelectedRequestId(selectedId ?? null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedRequestId(null);
  }, []);

  const selectRequest = useCallback((requestId: string | null) => {
    setSelectedRequestId(requestId);
  }, []);

  return (
    <IssueManagerContext.Provider
      value={{
        isOpen,
        requests,
        selectedRequestId,
        openModal,
        closeModal,
        selectRequest,
      }}
    >
      {children}
    </IssueManagerContext.Provider>
  );
};

export const useIssueManager = () => {
  const context = useContext(IssueManagerContext);
  if (context === undefined) {
    throw new Error('useIssueManager must be used within an IssueManagerProvider');
  }
  return context;
};



