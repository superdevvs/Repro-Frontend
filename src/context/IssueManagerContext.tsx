import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { DashboardClientRequest } from '@/types/dashboard';

type IssueManagerShootOpenResult = 'opened' | 'missing' | 'unhandled';

type IssueManagerShootOpenHandler = (
  request: DashboardClientRequest,
) => Promise<IssueManagerShootOpenResult> | IssueManagerShootOpenResult;

interface IssueManagerContextType {
  isOpen: boolean;
  requests: DashboardClientRequest[];
  selectedRequestId: string | null;
  openModal: (requests: DashboardClientRequest[], selectedRequestId?: string | null) => void;
  closeModal: () => void;
  selectRequest: (requestId: string | null) => void;
  removeRequest: (requestId: string) => void;
  registerShootOpenHandler: (handler: IssueManagerShootOpenHandler | null) => void;
  openRequestShoot: (request: DashboardClientRequest) => Promise<IssueManagerShootOpenResult>;
}

const IssueManagerContext = createContext<IssueManagerContextType | undefined>(undefined);

export const IssueManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<DashboardClientRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const shootOpenHandlerRef = useRef<IssueManagerShootOpenHandler | null>(null);

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

  const removeRequest = useCallback((requestId: string) => {
    setRequests((prev) => prev.filter((request) => String(request.id) !== String(requestId)));
    setSelectedRequestId((prev) => (prev === String(requestId) ? null : prev));
  }, []);

  const registerShootOpenHandler = useCallback((handler: IssueManagerShootOpenHandler | null) => {
    shootOpenHandlerRef.current = handler;
  }, []);

  const openRequestShoot = useCallback(async (request: DashboardClientRequest) => {
    const handler = shootOpenHandlerRef.current;
    if (!handler) return 'unhandled';
    return await handler(request);
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
        removeRequest,
        registerShootOpenHandler,
        openRequestShoot,
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



