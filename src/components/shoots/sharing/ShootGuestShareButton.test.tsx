import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootGuestShareButton } from './ShootGuestShareButton';

const auth = vi.hoisted(() => ({ role: 'client', user: { id: '12', role: 'superadmin' } }));
vi.mock('@/components/auth', () => ({ useAuth: () => auth }));
vi.mock('./ShootSharingDialog', () => ({
  ShootSharingDialog: function SharingDialogStub() {
    const [open, setOpen] = useState(false);
    return <>
      <button aria-label="Share shoot" onClick={() => setOpen(true)}>Magic Link</button>
      {open && <div role="dialog">Sharing controls</div>}
    </>;
  },
}));

const shoot = { id: '42', client: { id: '12' } } as ShootData;
beforeEach(() => { auth.role = 'client'; });
afterEach(cleanup);

describe('Magic Link sharing permission gate', () => {
  it.each(['can_share_guest', 'canShareGuest'] as const)('allows a rep only when %s grants access', capability => {
    auth.role = 'rep';
    const { rerender } = render(<ShootGuestShareButton shoot={{ ...shoot, [capability]: true }} />);
    expect(screen.getByRole('button', { name: 'Share shoot' })).toBeInTheDocument();

    rerender(<ShootGuestShareButton shoot={{ ...shoot, [capability]: false }} />);
    expect(screen.queryByRole('button', { name: 'Share shoot' })).not.toBeInTheDocument();

    rerender(<ShootGuestShareButton shoot={shoot} />);
    expect(screen.queryByRole('button', { name: 'Share shoot' })).not.toBeInTheDocument();
  });

  it.each(['can_share_guest', 'canShareGuest'] as const)('honors an explicit admin denial from %s', capability => {
    auth.role = 'admin';
    render(<ShootGuestShareButton shoot={{ ...shoot, [capability]: false }} />);
    expect(screen.queryByRole('button', { name: 'Share shoot' })).not.toBeInTheDocument();
  });

  it('allows the owning client on older payloads without the capability', () => {
    render(<ShootGuestShareButton shoot={shoot} />);
    expect(screen.getByRole('button', { name: 'Share shoot' })).toBeInTheDocument();
  });

  it('uses the effective client role and requires ownership on older payloads', () => {
    render(<ShootGuestShareButton shoot={{ ...shoot, client: { id: '99' } } as ShootData} />);
    expect(screen.queryByRole('button', { name: 'Share shoot' })).not.toBeInTheDocument();
  });

  it('removes open sharing controls as soon as permission is revoked', () => {
    const { rerender } = render(<ShootGuestShareButton shoot={{ ...shoot, canShareGuest: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share shoot' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<ShootGuestShareButton shoot={{ ...shoot, canShareGuest: false }} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share shoot' })).not.toBeInTheDocument();
  });

  it('resets open sharing controls when the viewed shoot changes', () => {
    const { rerender } = render(<ShootGuestShareButton shoot={shoot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share shoot' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<ShootGuestShareButton shoot={{ ...shoot, id: '43' }} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share shoot' })).toBeInTheDocument();
  });
});
