import { useEffect, useRef, type RefObject } from 'react';
import { scrollPaginatedListToTop } from '@/utils/paginationScroll';

interface PaginationScrollOptions<T extends HTMLElement> {
  pageSize?: number;
  isLoading?: boolean;
  targetRef?: RefObject<T>;
}

/** Reset after a page change has rendered, never on mount or a background refresh. */
export function usePaginationScrollReset<T extends HTMLElement = HTMLDivElement>(
  page: number | string,
  { pageSize, isLoading = false, targetRef }: PaginationScrollOptions<T> = {},
): RefObject<T> {
  const localRef = useRef<T>(null);
  const listRef = targetRef ?? localRef;
  const identity = `${page}:${pageSize ?? ''}`;
  const previous = useRef(identity);
  const pending = useRef(false);

  useEffect(() => {
    if (previous.current !== identity) {
      previous.current = identity;
      pending.current = true;
    }
    if (!pending.current || isLoading) return;

    const frame = requestAnimationFrame(() => {
      if (!listRef.current) return;
      scrollPaginatedListToTop(listRef.current);
      pending.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [identity, isLoading, listRef]);

  return listRef;
}
