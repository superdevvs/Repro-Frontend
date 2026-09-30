/** True when the user has a non-empty selection, optionally inside `boundary`. */
export function hasActiveTextSelection(boundary?: Node | null): boolean {
  if (typeof window === 'undefined' || typeof window.getSelection !== 'function') return false;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;
  if (!selection.toString().trim()) return false;
  if (!boundary) return true;
  const node = selection.anchorNode;
  return Boolean(node && boundary.contains(node));
}
