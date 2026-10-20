/** Scroll only the list's own vertical scroll area, preserving horizontal position. */
export function scrollPaginatedListToTop(list: HTMLElement): void {
  if (!list.getClientRects().length) return;

  let owner: HTMLElement | null = list;
  while (owner && owner !== document.body && owner !== document.documentElement) {
    const style = getComputedStyle(owner);
    const hasVerticalScroll = /^(auto|scroll|overlay)$/.test(style.overflowY);
    // Horizontal table wrappers also compute overflow-y:auto; skip those when
    // they do not own vertical scrolling. An explicitly targeted scroller still
    // resets when a shorter last page no longer fills it.
    if (hasVerticalScroll && (owner === list || owner.scrollHeight > owner.clientHeight || owner.scrollTop > 0)) {
      const top = owner === list ? 0 : owner.scrollTop + list.getBoundingClientRect().top
        - owner.getBoundingClientRect().top - owner.clientTop
        - (parseFloat(style.scrollPaddingTop) || 0)
        - (parseFloat(getComputedStyle(list).scrollMarginTop) || 0);
      owner.scrollTo({ top: Math.max(0, top), left: owner.scrollLeft, behavior: 'instant' });
      return;
    }
    owner = owner.parentElement;
  }

  const documentStyle = getComputedStyle(document.documentElement);
  window.scrollTo({
    top: Math.max(0, window.scrollY + list.getBoundingClientRect().top
      - (parseFloat(documentStyle.scrollPaddingTop) || 0)
      - (parseFloat(getComputedStyle(list).scrollMarginTop) || 0)),
    left: window.scrollX,
    behavior: 'instant',
  });
}
