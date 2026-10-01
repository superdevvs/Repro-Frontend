import { useEffect, useState } from 'react';
export function useCallSearch(value: string, delay = 250) {
  const [query, setQuery] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return query;
}
