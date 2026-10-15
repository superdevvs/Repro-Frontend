import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootNotesTab } from './ShootNotesTab';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '22', role: 'editor' } }) }));

afterEach(() => { cleanup(); localStorage.clear(); });

const mount = (permission?: boolean) => render(<ShootNotesTab
  shoot={{ id: '42', canViewVideoEditorContext: permission, notes: {
    shootNotes: 'Shoot instructions', editingNotes: 'Editing instructions', companyNotes: 'Keep the closing branded with the client name.',
    photographerNotes: 'Private photographer instructions', approvalNotes: 'Private approval instructions',
  } } as ShootData}
  role="editor" isAdmin={false} isPhotographer={false}
/>);

describe('video editor company notes', () => {
  it('shows authorized company notes as read-only and keeps other private notes hidden', () => {
    mount(true);
    const region = screen.getByRole('region', { name: 'Company Notes' });
    expect(region).toHaveTextContent('Keep the closing branded with the client name.');
    expect(within(region.parentElement!).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Private photographer instructions')).toBeNull();
    expect(screen.queryByText('Private approval instructions')).toBeNull();
    expect(screen.getByRole('region', { name: 'Editing Notes' })).toHaveTextContent('Editing instructions');
  });

  it.each([false, undefined])('hides company notes for photo-only/unassigned or unspecified editor access (%s)', permission => {
    mount(permission);
    expect(screen.queryByRole('region', { name: 'Company Notes' })).toBeNull();
    expect(screen.queryByText('Keep the closing branded with the client name.')).toBeNull();
  });

  it('revokes company note visibility when the shoot permission changes', () => {
    const { rerender } = mount(true);
    rerender(<ShootNotesTab shoot={{ id: '42', canViewVideoEditorContext: false, notes: { companyNotes: 'Previously visible company note' } } as ShootData}
      role="editor" isAdmin={false} isPhotographer={false} />);
    expect(screen.queryByRole('region', { name: 'Company Notes' })).toBeNull();
  });
});
