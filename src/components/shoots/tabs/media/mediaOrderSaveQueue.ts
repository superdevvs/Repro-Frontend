/** Serialize writes so a slow earlier request cannot overwrite the latest drag. */
export function createMediaOrderSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T,>(save: () => Promise<T>): Promise<T> => {
    const result = tail.then(save);
    tail = result.catch(() => undefined);
    return result;
  };
}
