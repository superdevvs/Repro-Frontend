import { useCallback, useEffect, useState } from 'react';

/** Preserve the full shoot page's delayed overview and explicit reopen behavior. */
export function useShootPageOverview(shootId: string | number | null | undefined) {
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
  const [autoOpenedOverviewShootId, setAutoOpenedOverviewShootId] = useState<string | number | null>(null);

  const openOverviewModal = useCallback(() => {
    if (shootId) {
      setAutoOpenedOverviewShootId(shootId);
    }
    setIsOverviewModalOpen(true);
  }, [shootId]);

  const closeOverviewModal = useCallback(() => {
    setIsOverviewModalOpen(false);
  }, []);

  useEffect(() => {
    if (!shootId || autoOpenedOverviewShootId === shootId) {
      return;
    }
    const timer = window.setTimeout(openOverviewModal, 2000);
    return () => window.clearTimeout(timer);
  }, [autoOpenedOverviewShootId, openOverviewModal, shootId]);

  return { isOverviewModalOpen, openOverviewModal, closeOverviewModal };
}
