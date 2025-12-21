import React, { createContext, useContext, useState, useCallback } from 'react';
import { DashboardIssueItem } from '@/types/dashboard';

interface IssueManagerContextType {
  isOpen: boolean;
  issues: DashboardIssueItem[];
  selectedIssueId: number | null;
  openModal: (issues: DashboardIssueItem[], selectedIssueId?: number | null) => void;
  closeModal: () => void;
  selectIssue: (issueId: number | null) => void;
}

const IssueManagerContext = createContext<IssueManagerContextType | undefined>(undefined);

export const IssueManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [issues, setIssues] = useState<DashboardIssueItem[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

  const openModal = useCallback((newIssues: DashboardIssueItem[], selectedId?: number | null) => {
    setIssues(newIssues);
    setSelectedIssueId(selectedId ?? null);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedIssueId(null);
  }, []);

  const selectIssue = useCallback((issueId: number | null) => {
    setSelectedIssueId(issueId);
  }, []);

  return (
    <IssueManagerContext.Provider
      value={{
        isOpen,
        issues,
        selectedIssueId,
        openModal,
        closeModal,
        selectIssue,
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



