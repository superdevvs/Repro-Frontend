import '@testing-library/jest-dom/vitest'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhotographerPickerMapShell } from './PhotographerPickerMapShell'

vi.mock('./PhotographerPickerMap', () => ({
  PhotographerPickerMap: (props: { className?: string }) => (
    <div data-testid="photographer-picker-map" className={props.className} />
  ),
}))

function mockMatchMedia(matchesFor: (query: string) => boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesFor(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('PhotographerPickerMapShell', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses responsive layout (not forced tabs) on tablet/desktop parents in portrait', () => {
    mockMatchMedia((query) => !query.includes('orientation: landscape'))
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
    expect(shell).toHaveAttribute('data-orientation', 'portrait')
    expect(shell.className).toMatch(/overflow-hidden/)
    expect(screen.getByTestId('photographer-picker-map').className).toMatch(/min-h-0/)
    expect(screen.getByTestId('photographer-picker-map').className).not.toMatch(/min-h-\[560/)
  })

  it('uses side-by-side 50/50 when landscape even under xl', () => {
    mockMatchMedia((query) => query.includes('orientation: landscape'))
    render(
      <div className="flex h-[768px] w-[1180px] flex-col">
        <PhotographerPickerMapShell
          isMobile={false}
          list={<div data-testid="picker-list">List</div>}
        />
      </div>,
    )
    const shell = screen.getByTestId('photographer-picker-map-shell')
    expect(shell).toHaveAttribute('data-layout', 'side-by-side')
    expect(shell).toHaveAttribute('data-orientation', 'landscape')
    expect(shell.querySelector('.grid-cols-2')).toBeTruthy()
  })

  it('marks compact chrome on short landscape heights', () => {
    mockMatchMedia(
      (query) =>
        query.includes('orientation: landscape') &&
        (!query.includes('max-height') || query.includes('max-height: 900px')),
    )
    render(
      <PhotographerPickerMapShell
        isMobile={false}
        list={<div data-testid="picker-list">List</div>}
      />,
    )
    expect(screen.getByTestId('photographer-picker-map-shell')).toHaveAttribute(
      'data-compact-chrome',
      'true',
    )
  })

  it('forces tabs when parent reports mobile (including phone landscape)', () => {
    mockMatchMedia((query) => query.includes('orientation: landscape'))
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
