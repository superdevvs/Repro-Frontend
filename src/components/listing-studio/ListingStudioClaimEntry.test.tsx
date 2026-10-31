import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LoginRedirect } from '@/components/auth/LoginRedirect';
import { forgetListingStudioClaim, readListingStudioClaim } from '@/lib/listingStudioClaim';
import { ListingStudioClaimEntry } from './ListingStudioClaimEntry';

const token = 'a'.repeat(64);
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}
function mount(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><LocationProbe /><Routes>
    <Route path="/listing-studio/claim" element={<ListingStudioClaimEntry><LoginRedirect /></ListingStudioClaimEntry>} />
    <Route path="/" element={<p>Login or create your account</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { const existing = readListingStudioClaim(); if (existing) forgetListingStudioClaim(existing); sessionStorage.clear(); });
afterEach(cleanup);

describe('Listing Studio claim handoff', () => {
  it.each([`#${token}`, `#token=${token}`])('captures %s before redirecting to sign in without leaking the token', async hash => {
    mount(`/listing-studio/claim${hash}`);
    await screen.findByText('Login or create your account');
    expect(readListingStudioClaim()).toBe(token);
    expect(screen.getByTestId('location').textContent).toBe('/?returnTo=%2Flisting-studio%2Fclaim');
    expect(screen.getByTestId('location')).not.toHaveTextContent(token);
  });
  it('retains a captured token across the login page reload and a clean return', async () => {
    const initial = mount(`/listing-studio/claim#${token}`);
    await screen.findByText('Login or create your account');
    initial.unmount();
    mount('/listing-studio/claim');
    await screen.findByText('Login or create your account');
    expect(sessionStorage.getItem('listing-studio.pending-claim')).toBe(token);
  });
  it('strips invalid fragments and query redirects without treating them as credentials', async () => {
    mount('/listing-studio/claim?token=secret&returnTo=https://example.test#not-a-token');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/?returnTo=%2Flisting-studio%2Fclaim'));
    expect(readListingStudioClaim()).toBeNull();
  });
});
