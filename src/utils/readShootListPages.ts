type ShootPageMeta = {
  last_page?: number;
};

export type ShootPage<T> = {
  data?: T[];
  meta?: ShootPageMeta;
};

/** Collect a complete operational lane before publishing it to the dashboard. */
export const readShootListPages = async <T, P extends ShootPage<T>>(
  first: P,
  readPage: (page: number) => Promise<P>,
  options: { page?: number; signal?: AbortSignal } = {},
): Promise<P> => {
  const checkAborted = () => {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };
  checkAborted();
  if ((options.page ?? 1) !== 1) return first;
  const lastPage = Number(first.meta?.last_page ?? 1);
  if (!Number.isSafeInteger(lastPage) || lastPage < 1) {
    throw new Error('Invalid shoot pagination');
  }
  const records = Array.isArray(first.data) ? [...first.data] : [];
  for (let page = 2; page <= lastPage; page += 1) {
    checkAborted();
    const next = await readPage(page);
    checkAborted();
    if (Array.isArray(next.data)) records.push(...next.data);
  }
  checkAborted();
  return { ...first, data: records };
};
