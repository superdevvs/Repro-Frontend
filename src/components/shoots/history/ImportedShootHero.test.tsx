import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CompletedAlbumCard } from './CompletedAlbumCard'
import { CompletedShootListRow } from './CompletedShootListRow'
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext'
import type { ShootData } from '@/types/shoots'

vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://reprodashboard.com' }))
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light' }) }))
afterEach(cleanup)

const previewPath = 'shoots/167/final/legacy-466078/small/cover.jpg'
const preview = `https://reprodashboard.com/api/public/shoot-media/file/${previewPath}?expires=1800000000&signature=preview`
const originalPath = 'shoots/167/final/legacy-466078/cover.jpg'
const original = `https://reprodashboard.com/api/public/shoot-media/file/${originalPath}?signature=original`
const shoot = {
  id: '167', status: 'delivered', workflowStatus: 'delivered',
  scheduledDate: '2026-09-26', completedDate: '2026-09-26',
  location: { address: 'Imported home', city: 'Rockville', state: 'MD', zip: '20852' },
  client: { name: 'Example Client' }, photographer: { name: 'Example Photographer' },
  services: ['HDR Photos'], payment: { totalQuote: 200, totalPaid: 200, paymentStatus: 'paid' },
  files: [{
    id: '2285', filename: 'cover.jpg', workflow_stage: 'completed', media_type: 'edited', is_cover: true,
    grid_url: preview, web_url: preview, medium_url: preview, thumbnail_url: preview,
    large_url: preview, large: preview, web_path: previewPath, thumbnail_path: previewPath,
    path: originalPath, original_url: original, url: original,
  }],
} as ShootData

describe('delivered imported hero images', () => {
  it.each(['list', 'grid'] as const)('renders the signed imported cover in %s view', (view) => {
    render(<UserPreferencesProvider>
      {view === 'list'
        ? <CompletedShootListRow shoot={shoot} onSelect={vi.fn()} isAdmin viewerRole="admin" />
        : <CompletedAlbumCard shoot={shoot} onSelect={vi.fn()} isAdmin viewerRole="admin" />}
    </UserPreferencesProvider>)
    for (const image of screen.getAllByRole('img', { name: 'Imported home' })) {
      expect(image).toHaveAttribute('src', preview)
    }
  })
})
