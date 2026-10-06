import { Children, useMemo, type ReactNode } from 'react'

/**
 * Masonry via round-robin column stacks (not CSS multi-column, not equal-row CSS grid).
 *
 * Why: CSS `columns` / pure multi-column flows top-to-bottom per column and breaks
 * newest-first left-to-right reading. Equal-row `display: grid` forces every card in a
 * row to the tallest height and leaves the gaps in the Shoot History screenshot.
 * Distributing children into N flex column stacks keeps the same breakpoint column
 * counts and 1rem gaps (see `.masonry-grid` / `.masonry-grid-col`), packs short cards
 * up under taller neighbors, never splits a card across columns, and keeps the first
 * visual "row" of tops in source order (1→2→3→… / newest-first). Keyboard/DOM order
 * is column-major (down each stack); there is no infinite-scroll sentinel on this grid
 * (backend pagination), so that tradeoff is acceptable.
 */
export function ShootHistoryGrid({ columns, children }: { columns: number; children: ReactNode }) {
  const columnCount = Math.max(1, columns)

  const columnStacks = useMemo(() => {
    const items = Children.toArray(children)
    const stacks: ReactNode[][] = Array.from({ length: columnCount }, () => [])
    items.forEach((child, index) => {
      stacks[index % columnCount].push(child)
    })
    return stacks
  }, [children, columnCount])

  return (
    <div data-shoot-history-grid className="masonry-grid items-start">
      {columnStacks.map((stack, colIdx) => (
        <div key={colIdx} className="masonry-grid-col">
          {stack}
        </div>
      ))}
    </div>
  )
}
