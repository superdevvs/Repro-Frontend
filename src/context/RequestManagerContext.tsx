import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { DashboardClientRequest } from '@/types/dashboard';

type RequestManagerShootOpenResult = 'opened' | 'missing' | 'unhandled';

type RequestManagerShootOpenHandler = (
  request: DashboardClientRequest,
) => Promise<RequestManagerShootOpenResult> | RequestManagerShootOpenResult;

interface RequestManagerContextType {
  isOpen: boolean;
  requests: DashboardClientRequest[];
  selectedRequestId: string | null;
  openModal: (requests: DashboardClientRequest[], selectedRequestId?: string | null) => void;
  closeModal: () => void;
  selectRequest: (requestId: string | null) => void;
  removeRequest: (requestId: string) => void;
  updateRequest: (requestId: string, updates: Partial<DashboardClientRequest>) => void;
  registerShootOpenHandler: (handler: RequestManagerShootOpenHandler | null) => void;
  openRequestShoot: (request: DashboardClientRequest) => Promise<RequestManagerShootOpenResult>;
}

const RequestManagerContext = createContext<RequestManagerContextType | undefined>(undefined);

export const RequestManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<DashboardClientRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const shootOpenHandlerRef = useRef<RequestManagerShootOpenHandler | null>(null);

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

  const updateRequest = useCallback((requestId: string, updates: Partial<DashboardClientRequest>) => {
    setRequests((prev) =>
      prev.map((request) =>
        String(request.id) === String(requestId)
          ? { ...request, ...updates }
          : request,
      ),
    );
  }, []);

  const registerShootOpenHandler = useCallback((handler: RequestManagerShootOpenHandler | null) => {
    shootOpenHandlerRef.current = handler;
  }, []);

  const openRequestShoot = useCallback(async (request: DashboardClientRequest) => {
    const handler = shootOpenHandlerRef.current;
    if (!handler) return 'unhandled';
    return await handler(request);
  }, []);

  return (
    <RequestManagerContext.Provider
      value={{
        isOpen,
        requests,
        selectedRequestId,
        openModal,
        closeModal,
        selectRequest,
        removeRequest,
        updateRequest,
        registerShootOpenHandler,
        openRequestShoot,
      }}
    >
      {children}
    </RequestManagerContext.Provider>
  );
};

export const useRequestManager = () => {
  const context = useContext(RequestManagerContext);
  if (context === undefined) {
    throw new Error('useRequestManager must be used within a RequestManagerProvider');
  }
  return context;
};



