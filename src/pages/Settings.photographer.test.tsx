import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Settings from './Settings';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'photographer', user: { id: '42', role: 'photographer' } }) }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => { throw new Error('Generic settings should not mount for photographers'); } }));

function AccountDestination() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}</output>;
}

describe('photographer settings entry', () => {
  afterEach(cleanup);
  it.each([
    ['/settings', '/photographer-account?tab=work'],
    ['/settings?tab=profile', '/photographer-account?tab=personal'],
    ['/settings?tab=notifications', '/photographer-account?tab=notifications'],
  ])('routes %s to the single photographer account screen', async (entry, destination) => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/photographer-account" element={<AccountDestination />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(destination));
  });
});
