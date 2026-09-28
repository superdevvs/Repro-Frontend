import type { ReactNode } from 'react'

/** Keep visual rows, keyboard traversal and the list view in the same order. */
export function ShootHistoryGrid({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <div
      data-shoot-history-grid
      className="masonry-grid items-start"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}
