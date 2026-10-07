import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootNotesTab } from './ShootNotesTab';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/config/env', () => ({ API_BASE_URL: 'https://api.test' }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShootNotesTab mobile readability', () => {
  it.each(['salesRep', 'sales_rep', 'sales-rep', 'rep', 'representative'])('allows %s to edit every note category on an unassigned shoot', role => {
    render(<ShootNotesTab shoot={{ id: 'muted-rep-notes', assignedRepId: null, approval_notes: 'Historical approved decision' } as unknown as ShootData} isAdmin={false} isPhotographer={false} role={role} />);
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(5);
    expect(screen.getByText(/Historical approval decision \(read-only\)/)).toBeInTheDocument();
    expect(screen.getByTestId('shoot-note-body-approvalNotes')).not.toHaveTextContent('Historical approved decision');
  });
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
    expect(shootBody.className).not.toMatch(/min-h-/);

    expect(screen.getByTestId('shoot-note-body-photographerNotes')).toHaveClass('text-foreground');
    expect(screen.getByTestId('shoot-note-body-editingNotes')).toHaveClass('text-foreground');

    // Read mode must not rely on a readOnly textarea (iOS/PWA often mutes those).
    expect(document.querySelector('textarea[readonly]')).toBeNull();
  });

  it('keeps empty note bodies collapsed (no tall min-height empty boxes)', () => {
    const shoot = {
      id: 'notes-mobile-empty',
      notes: {
        shootNotes: '',
        approvalNotes: '',
        photographerNotes: '',
        editingNotes: '',
      },
    } as ShootData;

    render(
      <ShootNotesTab
        shoot={shoot}
        isAdmin
        isPhotographer={false}
        role="admin"
      />,
    );

    for (const noteType of ['shootNotes', 'approvalNotes', 'photographerNotes', 'companyNotes'] as const) {
      const body = screen.getByTestId(`shoot-note-body-${noteType}`);
      expect(body).toHaveAttribute('data-note-empty', 'true');
      expect(body.className).not.toMatch(/min-h-/);
      expect(body).toHaveClass('py-1.5');
      expect(body.className).not.toMatch(/min-h-\[56px\]|min-h-\[96px\]|min-h-\[80px\]/);
    }
  });
});
