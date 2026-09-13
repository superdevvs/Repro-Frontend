const sourceKey = (image: HTMLImageElement): string => {
  const pictureSources = image.parentElement?.tagName === 'PICTURE'
    ? Array.from(image.parentElement.querySelectorAll('source')).map((source) =>
      [source.srcset, source.media, source.type, source.sizes].join('|')).join(';')
    : '';
  return [image.currentSrc, image.getAttribute('src'), image.srcset, image.sizes, pictureSources].join('|');
};

const hasSource = (image: HTMLImageElement): boolean => Boolean(
  image.currentSrc || image.getAttribute('src')?.trim() || image.srcset.trim()
  || (image.parentElement?.tagName === 'PICTURE'
    && image.parentElement.querySelector('source[srcset]:not([srcset=""])')),
);

const isVisible = (image: HTMLImageElement, root: HTMLElement, view: Window): boolean => {
  const imageRect = image.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  let left = Math.max(0, rootRect.left, imageRect.left);
  let right = Math.min(view.innerWidth, rootRect.right, imageRect.right);
  let top = Math.max(0, rootRect.top, imageRect.top);
  let bottom = Math.min(view.innerHeight, rootRect.bottom, imageRect.bottom);
  if (imageRect.width <= 0 || imageRect.height <= 0
    || left >= right || top >= bottom) return false;

  for (let element: HTMLElement | null = image; element; element = element.parentElement) {
    const style = view.getComputedStyle(element);
    if (element.hidden || style.display === 'none' || style.visibility === 'hidden'
      || style.visibility === 'collapse') return false;
    if (element !== image) {
      const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX || style.overflow);
      const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY || style.overflow);
      if (clipsX || clipsY) {
        const bounds = element.getBoundingClientRect();
        if (clipsX) {
          left = Math.max(left, bounds.left);
          right = Math.min(right, bounds.right);
        }
        if (clipsY) {
          top = Math.max(top, bounds.top);
          bottom = Math.min(bottom, bounds.bottom);
        }
        if (left >= right || top >= bottom) return false;
      }
    }
  }
  return true;
};

/** Observe only the page's currently visible images during its initial loading phase. */
export function observePageImages(
  root: HTMLElement,
  onPendingChange: (pending: boolean) => void,
): () => void {
  const view = root.ownerDocument.defaultView;
  if (!view) {
    onPendingChange(false);
    return () => undefined;
  }

  const settled = new WeakMap<HTMLImageElement, string>();
  let lastPending: boolean | undefined;
  let disposed = false;

  const scan = () => {
    if (disposed) return;
    const pending = Array.from(root.querySelectorAll('img')).some((image) =>
      hasSource(image) && !image.complete && settled.get(image) !== sourceKey(image)
      && isVisible(image, root, view));
    if (pending !== lastPending) {
      lastPending = pending;
      onPendingChange(pending);
    }
  };

  const onSettled = (event: Event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && root.contains(image)) {
      settled.set(image, sourceKey(image));
      scan();
    }
  };

  const observer = new MutationObserver(scan);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset', 'sizes', 'media', 'type', 'hidden', 'class', 'style'],
  });
  root.addEventListener('load', onSettled, true);
  root.addEventListener('error', onSettled, true);
  root.addEventListener('scroll', scan, true);
  view.addEventListener('scroll', scan, true);
  view.addEventListener('resize', scan);
  scan();

  return () => {
    disposed = true;
    observer.disconnect();
    root.removeEventListener('load', onSettled, true);
    root.removeEventListener('error', onSettled, true);
    root.removeEventListener('scroll', scan, true);
    view.removeEventListener('scroll', scan, true);
    view.removeEventListener('resize', scan);
  };
}
