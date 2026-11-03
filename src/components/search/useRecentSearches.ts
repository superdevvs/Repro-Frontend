import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecentSearchEntry {
  id: string;
  query: string;
  scope: string;
  label: string;
  searchedAt: number;
}

const PREFIX = 'repro:recent-searches:v1:';
const UPDATED = 'repro:recent-searches-updated';
const LIMIT = 8;
const storageKey = (identity: string) => `${PREFIX}${encodeURIComponent(identity)}`;
const entryId = (query: string, scope: string) => JSON.stringify([scope, query.toLocaleLowerCase()]);

function read(identity: string): RecentSearchEntry[] | undefined {
  if (!identity) return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey(identity)) ?? '[]');
    if (!Array.isArray(value)) return [];
    const entries = new Map<string, RecentSearchEntry>();
    for (const item of value) {
      if (!item || typeof item.query !== 'string' || typeof item.scope !== 'string' || typeof item.label !== 'string'
        || typeof item.searchedAt !== 'number' || !Number.isFinite(item.searchedAt)) continue;
      const query = item.query.trim().slice(0, 200);
      const scope = item.scope.slice(0, 100);
      if (!query || !scope) continue;
      const id = entryId(query, scope);
      if (!entries.has(id)) entries.set(id, { id, query, scope, label: item.label.slice(0, 100), searchedAt: item.searchedAt });
      if (entries.size === LIMIT) break;
    }
    return [...entries.values()];
  } catch {
    return undefined;
  }
}

export function useRecentSearches(identity: string | undefined) {
  const owner = identity ?? '';
  const [state, setState] = useState(() => ({ owner, entries: read(owner) ?? [] }));
  // Never render the previous account's history while an identity change is being applied.
  const entries = state.owner === owner ? state.entries : [];
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    setState({ owner, entries: read(owner) ?? [] });
    const onUpdate = (event: Event) => {
      const update = (event as CustomEvent<{ owner: string; entries: RecentSearchEntry[] }>).detail;
      if (update.owner === owner) setState({ owner, entries: update.entries });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey(owner)) setState({ owner, entries: read(owner) ?? [] });
    };
    window.addEventListener(UPDATED, onUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(UPDATED, onUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, [owner]);

  const update = useCallback((change: (previous: RecentSearchEntry[]) => RecentSearchEntry[]) => {
    if (!owner) return;
    const next = change(read(owner) ?? entriesRef.current);
    entriesRef.current = next;
    try {
      if (next.length) window.localStorage.setItem(storageKey(owner), JSON.stringify(next));
      else window.localStorage.removeItem(storageKey(owner));
    } catch { /* History remains usable in memory when browser storage is unavailable. */ }
    setState({ owner, entries: next });
    window.dispatchEvent(new CustomEvent(UPDATED, { detail: { owner, entries: next } }));
  }, [owner]);

  const remember = useCallback((value: string, scope = 'everywhere', label = 'Everywhere') => {
    const query = value.trim().slice(0, 200);
    if (!query || !scope) return;
    const id = entryId(query, scope);
    update(previous => [{ id, query, scope, label, searchedAt: Date.now() }, ...previous.filter(entry => entry.id !== id)].slice(0, LIMIT));
  }, [update]);
  const remove = useCallback((id: string) => update(previous => previous.filter(entry => entry.id !== id)), [update]);
  const clear = useCallback(() => update(() => []), [update]);

  return { entries, remember, remove, clear };
}
