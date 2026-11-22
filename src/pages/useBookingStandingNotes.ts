import { useEffect, useState } from 'react';

export function useBookingStandingNotes(clientId: string, enabled: boolean) {
  const [skipped, setSkipped] = useState(false);
  useEffect(() => { setSkipped(false); }, [clientId]);
  return { enabled, skipped, setSkipped };
}
