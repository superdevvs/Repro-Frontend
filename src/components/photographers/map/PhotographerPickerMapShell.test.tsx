import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhotographerPickerMapShell } from './PhotographerPickerMapShell'

vi.mock('./PhotographerPickerMap', () => ({
  PhotographerPickerMap: (props: { className?: string }) => (
    <div data-testid="photographer-picker-map" className={props.className} />
  ),
}))

describe('PhotographerPickerMapShell', () => {
  it('uses responsive layout (not forced tabs) on tablet/desktop parents', () => {
    render(
      <div className="flex h-[700px] flex-col">
        <PhotographerPickerMapShell
          isMobile={false}
          list={<div data-testid="picker-list">List</div>}
        />
      </div>,
    )
    const shell = screen.getByTestId('photographer-picker-map-shell')
    expect(shell).toHaveAttribute('data-layout', 'responsive')
    expect(shell.className).toMatch(/overflow-hidden/)
    expect(screen.getByTestId('photographer-picker-map').className).toMatch(/min-h-0/)
    expect(screen.getByTestId('photographer-picker-map').className).not.toMatch(/min-h-\[560/)
  })

  it('forces tabs when parent reports mobile', () => {
    render(
      <PhotographerPickerMapShell
        isMobile
        list={<div data-testid="picker-list">List</div>}
      />,
    )
    expect(screen.getByTestId('photographer-picker-map-shell')).toHaveAttribute('data-layout', 'tabs')
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'List' })).toBeInTheDocument()
  })
})
