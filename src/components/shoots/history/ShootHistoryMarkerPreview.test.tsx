import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { ShootHistoryMarkerPreview } from './ShootHistoryMarkerPreview'
import type { MapMarker } from './shootHistoryUtils'

const marker: MapMarker = {
  id: 'shoot-42',
  title: 'Repro Photos',
  subtitle: 'Aug 31, 2026 · 2:30 PM',
  address: '42 Main Street, Austin, TX',
  coords: { lat: 30.2672, lng: -97.7431 },
  imageUrl: 'https://images.example.test/property.jpg',
  status: 'ready_for_review',
}

describe('ShootHistoryMarkerPreview', () => {
  it('shows the property image, address, status, and scheduled time', () => {
    render(<ShootHistoryMarkerPreview marker={marker} theme="light" />)

    expect(screen.getByRole('img', { name: marker.address })).toHaveAttribute(
      'src',
      marker.imageUrl,
    )
    expect(screen.getByText(marker.address)).toBeInTheDocument()
    expect(screen.getByText('Ready For Review')).toBeInTheDocument()
    expect(screen.getByText(marker.subtitle!)).toBeInTheDocument()
  })

  it('opens the existing shoot Overview when the property card is clicked', () => {
    const onOpen = vi.fn()
    render(
      <ShootHistoryMarkerPreview
        marker={{ ...marker, onOpen }}
        theme="dark"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: `View Overview for ${marker.address}` }),
    )

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(screen.getByText('View Overview')).toBeInTheDocument()
  })

  it('offers an independent close control for the Google map popup', () => {
    const onOpen = vi.fn()
    const onDismiss = vi.fn()
    render(
      <ShootHistoryMarkerPreview
        marker={{ ...marker, onOpen }}
        onDismiss={onDismiss}
        theme="light"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close property preview' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
