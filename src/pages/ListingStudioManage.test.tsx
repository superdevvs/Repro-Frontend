import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import ListingStudioManage from './ListingStudioManage';
const auth = vi.hoisted(() => ({ user: { id: '9', role: 'salesrep', isActive: true, secondary_roles: [] as string[] }, isAuthenticated: true, isLoading: false, isImpersonating: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/components/listing-studio/staff/StudioClientPicker', () => ({ StudioClientPicker: ({ actorId }: { actorId: string }) => <p>Client picker for {actorId}</p> }));
vi.mock('@/components/listing-studio/staff/StudioManagedWorkspace', () => ({ StudioManagedWorkspace: ({ actorId, clientId }: { actorId: string; clientId: string }) => <p>Managing {clientId} as actor {actorId}</p> }));
const view = (path = '/listing-studio/manage') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/listing-studio/manage" element={<ListingStudioManage />} /><Route path="/listing-studio/manage/:clientId" element={<ListingStudioManage />} /></Routes></MemoryRouter>);
beforeEach(() => { auth.user = { id: '9', role: 'salesrep', isActive: true, secondary_roles: [] }; auth.isImpersonating = false; auth.isAuthenticated = true; auth.isLoading = false; });
afterEach(cleanup);
describe('staff billing route eligibility', () => {
  it.each(['salesrep', 'rep', 'salesRep', 'superadmin'])('allows primary %s to choose a client', role => { auth.user.role = role; view(); expect(screen.getByText('Client picker for 9')).toBeInTheDocument(); });
  it.each(['admin', 'client', 'editor'])('does not inherit purchase authority from %s secondary roles', role => { auth.user.role = role; auth.user.secondary_roles = ['superadmin']; view(); expect(screen.getByText(/Use your own authorized rep/)).toBeInTheDocument(); expect(screen.queryByText('Client picker for 9')).not.toBeInTheDocument(); });
  it('refuses impersonation and inactive staff', () => { auth.isImpersonating = true; view(); expect(screen.queryByText('Client picker for 9')).not.toBeInTheDocument(); cleanup(); auth.isImpersonating = false; auth.user.isActive = false; view(); expect(screen.queryByText('Client picker for 9')).not.toBeInTheDocument(); });
  it('keeps actor and beneficiary as distinct explicit identities', () => { view('/listing-studio/manage/42'); expect(screen.getByText('Managing 42 as actor 9')).toBeInTheDocument(); });
});
