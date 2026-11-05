/** Serialize writes so a slow earlier request cannot overwrite the latest drag. */
export function createMediaOrderSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T,>(save: () => Promise<T>): Promise<T> => {
    const result = tail.then(save);
    tail = result.catch(() => undefined);
    return result;
  };
}

/** Autosave, Save, and close can request the same pending arrangement. */
export function createMediaOrderSaveDeduplicator<T>() {
  let pending: { fingerprint: string; result: Promise<T> } | null = null;
  return (fingerprint: string, save: () => Promise<T>): Promise<T> => {
    if (pending?.fingerprint === fingerprint) return pending.result;
    const result = save();
    const request = { fingerprint, result };
    pending = request;
    const clear = () => { if (pending === request) pending = null; };
    void result.then(clear, clear);
    return result;
  };
}

const pendingByShoot = new Map<string, Promise<unknown>>();

/** Closing and reopening a pane must not let its older request finish last. */
export function enqueueShootMediaOrderSave<T>(shootId: string | number, save: () => Promise<T>): Promise<T> {
  const key = String(shootId);
  const previous = pendingByShoot.get(key) ?? Promise.resolve();
  const result = previous.then(save);
  const tail = result.catch(() => undefined);
  pendingByShoot.set(key, tail);
  void tail.then(() => {
    if (pendingByShoot.get(key) === tail) pendingByShoot.delete(key);
  });
  return result;
}
