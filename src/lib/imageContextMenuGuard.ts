const isImageTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.matches('img, svg image');

export const installImageContextMenuGuard = (targetDocument: Document = document) => {
  const preventImageContextMenu = (event: MouseEvent) => {
    if (event.composedPath().some(isImageTarget)) {
      event.preventDefault();
    }
  };

  // Capture at the document boundary so images rendered by portals or separate
  // React roots receive the same protection without changing their click logic.
  targetDocument.addEventListener('contextmenu', preventImageContextMenu, true);

  return () => {
    targetDocument.removeEventListener('contextmenu', preventImageContextMenu, true);
  };
};
