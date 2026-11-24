import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import ListingStudioManage from './ListingStudioManage';
const auth = vi.hoisted(() => ({ user: { id: '9', role: 'salesrep', isActive: true, secondary_roles: [] as string[] }, isAuthenticated: true, isLoading: false, isImpersonating: false }));
const permission = vi.hoisted(() => ({ can: vi.fn(() => false), isLoading: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => permission }));
vi.mock('@/components/listing-studio/staff/StudioPricingOverview', () => ({ StudioPricingOverview: ({ actorId }: { actorId: string }) => <p>Pricing overview for {actorId}</p> }));
vi.mock('@/components/listing-studio/staff/StudioManagedWorkspace', () => ({ StudioManagedWorkspace: ({ actorId, clientId }: { actorId: string; clientId: string }) => <p>Managing {clientId} as actor {actorId}</p> }));
function EditorDestination() {
  const { pathname, search, hash } = useLocation();
  return <p>{pathname + search + hash}</p>;
}
const view = (path = '/listing-studio/manage') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/listing-studio/manage" element={<ListingStudioManage />} /><Route path="/listing-studio/manage/:clientId" element={<ListingStudioManage />} /><Route path="/ai-editing" element={<EditorDestination />} /></Routes></MemoryRouter>);
beforeEach(() => { auth.user = { id: '9', role: 'salesrep', isActive: true, secondary_roles: [] }; auth.isImpersonating = false; auth.isAuthenticated = true; auth.isLoading = false; permission.can.mockReset().mockReturnValue(false); permission.isLoading = false; });
afterEach(cleanup);
describe('staff billing route eligibility', () => {
  it.each(['salesrep', 'rep', 'salesRep', 'superadmin', 'admin'])('allows primary %s to view the pricing overview', role => { auth.user.role = role; view(); expect(screen.getByText('Pricing overview for 9')).toBeInTheDocument(); });
  it.each(['client', 'editor'])('does not inherit purchase authority from %s secondary roles', role => { auth.user.role = role; auth.user.secondary_roles = ['superadmin']; view(); expect(screen.getByText(/Use your own authorized rep/)).toBeInTheDocument(); expect(screen.queryByText('Pricing overview for 9')).not.toBeInTheDocument(); });
  it('refuses impersonation and inactive staff', () => { auth.isImpersonating = true; view(); expect(screen.queryByText('Pricing overview for 9')).not.toBeInTheDocument(); cleanup(); auth.isImpersonating = false; auth.user.isActive = false; view(); expect(screen.queryByText('Pricing overview for 9')).not.toBeInTheDocument(); });
  it('keeps primary admin pricing read-only and blocks a delegated client route', () => { auth.user.role = 'admin'; view('/listing-studio/manage/42'); expect(screen.queryByText(/Managing 42/)).not.toBeInTheDocument(); expect(screen.getByText(/Use your own authorized rep/)).toBeInTheDocument(); });
  it('keeps actor and beneficiary as distinct explicit identities', () => { view('/listing-studio/manage/42'); expect(screen.getByText('Managing 42 as actor 9')).toBeInTheDocument(); });
  it('opens an allowed client bookmark in the Listing Studio tab and keeps its query and hash', async () => {
    auth.user.role = 'superadmin';
    permission.can.mockReturnValue(true);
    view('/listing-studio/manage/42?tab=orders#purchase-history');
    expect(await screen.findByText('/ai-editing?tab=orders&section=listing-studio&clientId=42#purchase-history')).toBeInTheDocument();
  });
  it('rejects a delegated bookmark from admin even if AI Editing is available', () => {
    auth.user.role = 'admin';
    permission.can.mockReturnValue(true);
    view('/listing-studio/manage/42?tab=orders');
    expect(screen.getByText(/Use your own authorized rep/)).toBeInTheDocument();
  });
});
