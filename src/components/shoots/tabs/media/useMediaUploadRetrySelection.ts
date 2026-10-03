import { useRef, useState } from 'react';

type MediaType = 'raw' | 'edited' | 'extra';
type Entry = { file: File; confirmed: boolean };
const keyFor = (file: File) => JSON.stringify([file.name, file.size, file.type, file.lastModified]);

/** Retain browser File objects so an explicit retry reuses its upload identity. */
export function useMediaUploadRetrySelection(scope: string) {
  const state = useRef<{ scope: string; entries: Map<MediaType, Entry[]> }>({ scope, entries: new Map() });
  const [, setRevision] = useState(0);
  if (state.current.scope !== scope) state.current = { scope, entries: new Map() };

  const prepare = (type: MediaType, incoming: File[]) => {
    const entries = state.current.entries.get(type) ?? [];
    const byKey = new Map(entries.map((entry) => [keyFor(entry.file), entry]));
    const files = incoming.flatMap((file) => {
      const previous = byKey.get(keyFor(file));
      if (previous?.confirmed) return [];
      if (previous) return [previous.file];
      const entry = { file, confirmed: false };
      entries.push(entry);
      byKey.set(keyFor(file), entry);
      return [file];
    });
    state.current.entries.set(type, entries);
    return files;
  };

  const record = (type: MediaType, files: File[], confirmedIndexes: number[]) => {
    const confirmed = new Set(confirmedIndexes.map((index) => files[index]));
    const entries = state.current.entries.get(type) ?? [];
    entries.forEach((entry) => { entry.confirmed ||= confirmed.has(entry.file); });
    if (entries.every((entry) => entry.confirmed)) state.current.entries.delete(type);
    setRevision((value) => value + 1);
  };

  return {
    prepare,
    record,
    pending: (type: MediaType) => {
      return (state.current.entries.get(type) ?? []).filter((entry) => !entry.confirmed).map((entry) => entry.file);
    },
  };
}
