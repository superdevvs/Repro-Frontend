import { readShootListPages, type ShootPage } from '@/utils/readShootListPages';

export class DashboardSectionError extends Error {
  constructor(public section: string, public page: number, public status?: number, public reference?: string) {
    super(`The ${section} section could not refresh (page ${page}).`);
    this.name = 'DashboardSectionError';
  }
}

export const readDashboardSection = async <T, P extends ShootPage<T>>(
  section: string,
  read: (page: number, signal?: AbortSignal) => Promise<Response>,
  options: { page: number; signal?: AbortSignal; allPages: boolean },
): Promise<P> => {
  const checkAborted = () => {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };
  const readPage = async (page: number): Promise<P> => {
    for (let attempt = 0; ; attempt++) {
      checkAborted();
      let status: number | undefined;
      let reference: string | undefined;
      const controller = new AbortController();
      const abort = () => controller.abort();
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
      options.signal?.addEventListener('abort', abort, { once: true });
      try {
        const response = await read(page, controller.signal);
        checkAborted();
        status = response.status;
        reference = response.headers?.get('X-Correlation-ID') ?? response.headers?.get('X-Request-ID') ?? undefined;
        if (status === 401 || status === 419) throw new Error('Unauthorized');
        if (!response.ok) throw new Error('Request failed');
        const payload = JSON.parse(await response.text()) as P;
        checkAborted();
        if (!Array.isArray(payload.data)) throw new Error('Invalid shoot response');
        return payload;
      } catch (error) {
        checkAborted();
        if (((error as Error)?.name === 'AbortError' && !timedOut) || (error as Error)?.message === 'Unauthorized') throw error;
        if (attempt >= 2 || (status !== undefined && status >= 400 && status < 500 && status !== 429)) {
          const failure = new DashboardSectionError(section, page, status, reference);
          console.error('Dashboard section refresh failed', { section, page, status, reference, attempts: attempt + 1 });
          throw failure;
        }
        // Retry just this failed page; successful sections and earlier pages remain intact.
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
          const timer = setTimeout(() => { options.signal?.removeEventListener('abort', onAbort); resolve(); }, 150 * (2 ** attempt));
          options.signal?.addEventListener('abort', onAbort, { once: true });
        });
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
      }
    }
  };
  const first = await readPage(options.page);
  return options.allPages ? readShootListPages(first, readPage, options) : first;
};
