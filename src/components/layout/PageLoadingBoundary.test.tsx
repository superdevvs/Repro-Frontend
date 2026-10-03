import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageLoadingBoundary } from './PageLoadingBoundary';
import { usePageLoading } from '@/hooks/use-page-loading';
afterEach(cleanup);
function Section({ loading, click }: { loading: boolean; click: () => void }) {
  usePageLoading(loading);
  return <><button onClick={click}>Open shoot</button>{loading && <p>Loading totals…</p>}<img src="/slow-photo.jpg" alt="Loading photo" /></>;
}
describe('progressive page loading', () => {
  it('keeps available content interactive while other sections and images load', () => {
    const click = vi.fn();
    render(<PageLoadingBoundary><Section loading click={click} /></PageLoadingBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'Open shoot' }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole('button').closest('[inert]')).toBeNull();
    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
  });
  it('does not hide content on refresh or a new route', () => {
    const { rerender } = render(<PageLoadingBoundary key="a"><Section loading={false} click={() => {}} /></PageLoadingBoundary>);
    rerender(<PageLoadingBoundary key="b"><Section loading click={() => {}} /></PageLoadingBoundary>);
    expect(screen.getByRole('button')).toBeVisible();
    expect(screen.getByText('Loading totals…')).toBeVisible();
  });
});
