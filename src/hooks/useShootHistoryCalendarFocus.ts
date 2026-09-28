import { useCallback, useRef, type MouseEvent } from 'react'

/** The overview is opened programmatically, so Radix has no DialogTrigger to restore. */
export function useShootHistoryCalendarFocus(detailOpen: boolean) {
  const openRef = useRef(detailOpen)
  openRef.current = detailOpen
  const originRef = useRef<{ button: HTMLElement; panel: HTMLElement; shootId: string } | null>(null)
  const capture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-shoot-id]') : null
    if (button) originRef.current = { button, panel: event.currentTarget, shootId: button.dataset.shootId ?? '' }
  }, [])
  const restore = useCallback((event: Event) => {
    const origin = originRef.current
    if (!origin) return
    event.preventDefault()
    // The loading and loaded dialog content can swap while the modal stays open.
    if (openRef.current) return
    const replacement = Array.from(origin.panel.querySelectorAll<HTMLButtonElement>('button[data-shoot-id]'))
      .find(button => button.dataset.shootId === origin.shootId && button.getClientRects().length > 0)
    const target = origin.button.isConnected && origin.button.getClientRects().length > 0
      ? origin.button
      : replacement ?? origin.panel.querySelector<HTMLButtonElement>('button')
    target?.focus({ preventScroll: true })
    originRef.current = null
  }, [])
  return { capture, restore }
}
