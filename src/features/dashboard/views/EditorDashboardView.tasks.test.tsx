import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { EditorDashboardView } from './EditorDashboardView';

const state = vi.hoisted(() => ({ mobile: false, get: vi.fn(), post: vi.fn(), refetch: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'editor', user: { id: 42, role: 'editor' } }) }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => state.mobile }));
vi.mock('@/services/api', () => ({ apiClient: { get: state.get, post: state.post } }));
vi.mock('@/hooks/useEditorDashboardQueue', () => ({ useEditorDashboardQueue: () => ({ sourceShoots: [], upcomingShoots: [], upcomingSummaries: [{ id: 1, addressLine: 'Legacy assignment' }], deliveredSummaries: [] }) }));
vi.mock('@/hooks/useEditorEditingTasks', () => ({ useEditorEditingTasks: () => ({ data: [{ shoot_id: 2, shoot: { id: 2, addressLine: 'Task-only assignment', hasScopedEditingTasks: true } }], refetch: state.refetch }) }));
vi.mock('../hooks/useDashboardMetrics', () => ({ useEditorDashboardMetrics: () => [] }));
vi.mock('../hooks/useDashboardOnboarding', () => ({ useDashboardOnboarding: () => ({ onboardingState: {} }) }));
vi.mock('../components/DashboardOnboarding', () => ({ DashboardOnboarding: () => null }));
vi.mock('@/components/dashboard/v2/EditorRawLinksCard', () => ({ EditorRawLinksCard: () => null }));
vi.mock('@/components/dashboard/v2/PendingReviewsCard', () => ({ PendingReviewsCard: () => null }));
vi.mock('../components/RoleDashboardLayout', () => ({ RoleDashboardLayout: ({ upcomingCard, mobileTabs }: { upcomingCard: React.ReactNode; mobileTabs: { content: React.ReactNode }[] }) => <main>{state.mobile ? mobileTabs[0].content : upcomingCard}</main> }));
vi.mock('@/components/dashboard/v2/UpcomingShootsCard', () => ({ UpcomingShootsCard: ({ shoots, onSelect }: { shoots: DashboardShootSummary[]; onSelect: (shoot: DashboardShootSummary) => void }) => <>{shoots.map(shoot => <button key={shoot.id} onClick={() => onSelect(shoot)}>{shoot.addressLine}</button>)}</> }));

beforeEach(() => {
  state.mobile = false; state.get.mockReset(); state.post.mockReset(); state.refetch.mockReset();
  state.post.mockResolvedValue({ status: 202, data: {} });
});
afterEach(cleanup);
function dashboard(onSelectShoot = vi.fn()) {
  render(<MemoryRouter><EditorDashboardView clientRequests={[]} clientRequestsLoading={false} editingRequests={[]} editingRequestsLoading={false} editorPendingReviews={[]} greetingTitleFullName="Editor" shootDetailsModal={null} userId={42} onEditingRequestCenterOpen={vi.fn()} onEditingRequestOpenById={vi.fn()} onOpenShootInModalById={vi.fn()} scrollToDashboardSection={vi.fn()} onSelectShoot={onSelectShoot} /></MemoryRouter>);
  return onSelectShoot;
}
it.each([false, true])('opens the normal shoot Overview for a dispatch assignment (mobile %s)', mobile => {
  state.mobile = mobile;
  const ordinary = dashboard();
  fireEvent.click(screen.getByRole('button', { name: 'Task-only assignment' }));
  expect(ordinary).toHaveBeenCalledWith(expect.objectContaining({ id: 2, hasScopedEditingTasks: true }), undefined);
  expect(state.get).not.toHaveBeenCalled();
});
it('preserves ordinary shoot selection for permanent editor assignments', () => {
  const ordinary = dashboard();
  fireEvent.click(screen.getByRole('button', { name: 'Legacy assignment' }));
  expect(ordinary).toHaveBeenCalledTimes(1);
  expect(ordinary.mock.calls[0][0]).toEqual(expect.objectContaining({ id: 1 }));
  expect(state.get).not.toHaveBeenCalled();
});
