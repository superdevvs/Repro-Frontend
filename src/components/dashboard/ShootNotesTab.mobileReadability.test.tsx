import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootNotesTab } from './ShootNotesTab';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.test' }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShootNotesTab mobile readability', () => {
  it('renders note bodies as wrapping foreground text (not a muted readonly textarea)', () => {
    const shoot = {
      id: 'notes-mobile-1',
      notes: {
        shootNotes: 'Gate code 4455 — park on the left side of the driveway near the oak tree.',
        photographerNotes: 'Client wants twilight exteriors if weather allows.',
        editingNotes: 'Please keep verticals straight on the living room plates.',
      },
    } as ShootData;

    render(
      <ShootNotesTab
        shoot={shoot}
        isAdmin={false}
        isPhotographer
        role="photographer"
      />,
    );

    const shootBody = screen.getByTestId('shoot-note-body-shootNotes');
    expect(shootBody.tagName).toBe('DIV');
    expect(shootBody).toHaveClass('text-foreground');
    expect(shootBody).toHaveClass('text-base');
    expect(shootBody).toHaveClass('whitespace-pre-wrap');
    expect(shootBody).toHaveClass('break-words');
    expect(shootBody).toHaveTextContent(/Gate code 4455/);

    expect(screen.getByTestId('shoot-note-body-photographerNotes')).toHaveClass('text-foreground');
    expect(screen.getByTestId('shoot-note-body-editingNotes')).toHaveClass('text-foreground');

    // Read mode must not rely on a readOnly textarea (iOS/PWA often mutes those).
    expect(document.querySelector('textarea[readonly]')).toBeNull();
  });
});
