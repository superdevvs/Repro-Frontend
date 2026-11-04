import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StudioImage } from './StudioImage';

const api = vi.hoisted(() => ({ get: vi.fn(), defaults: { baseURL: '/api' } }));
vi.mock('@/services/api', () => ({ apiClient: api }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 1 }, role: 'admin', isImpersonating: false }) }));
beforeEach(() => {
  vi.useFakeTimers(); api.get.mockReset();
  vi.stubGlobal('IntersectionObserver', undefined);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const response = () => ({ data: new Blob(['jpeg'], { type: 'image/jpeg' }) });

it('loads an observed preview eagerly instead of leaving a second native lazy gate', async () => {
  vi.stubGlobal('IntersectionObserver', vi.fn(function (callback: (entries: { isIntersecting: boolean }[]) => void) {
    return { observe: () => callback([{ isIntersecting: true }]), disconnect: vi.fn() };
  }));
  api.get.mockResolvedValue(response());
  await act(async () => { render(<StudioImage src="/api/preview/visible" alt="Visible" />); });
  expect(screen.getByAltText('Visible')).toHaveAttribute('loading', 'eager');
  expect(screen.getByAltText('Visible')).toHaveAttribute('src', 'blob:preview');
});

it('shows an explicit fallback when a public output fails and recovers on a new source', () => {
  const { rerender } = render(<StudioImage src="/missing-output.jpg" alt="Output" />);
  fireEvent.error(screen.getByAltText('Output'));
  expect(screen.getByAltText('Output')).toHaveAttribute('data-preview-state', 'failed');
  expect(screen.getByAltText('Output').getAttribute('src')).toContain('Preview%20unavailable');
  rerender(<StudioImage src="/replacement.jpg" alt="Output" />);
  expect(screen.getByAltText('Output')).toHaveAttribute('src', '/replacement.jpg');
});

it('shares an authenticated preview request between visible copies of the same image', async () => {
  api.get.mockResolvedValue(response());
  await act(async () => { render(<><StudioImage src="/api/preview/shared" loading="eager" alt="One" /><StudioImage src="/api/preview/shared" loading="eager" alt="Two" /></>); });
  expect(api.get).toHaveBeenCalledOnce();
  expect(screen.getByAltText('One')).toHaveAttribute('src', 'blob:preview');
  expect(screen.getByAltText('Two')).toHaveAttribute('data-preview-state', 'ready');
});

it('recovers from a temporary server error with a bounded retry', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce(response());
  await act(async () => { render(<StudioImage src="/api/preview/temporary" loading="eager" alt="Temporary" />); });
  expect(screen.getByAltText('Temporary')).toHaveAttribute('aria-busy', 'true');
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(screen.getByAltText('Temporary')).toHaveAttribute('data-preview-state', 'ready');
});

it('does not retry forbidden images and does not retain a rejected promise on reopening', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  let first: ReturnType<typeof render>;
  await act(async () => { first = render(<StudioImage src="/api/preview/denied" loading="eager" alt="Denied" />); });
  expect(api.get).toHaveBeenCalledOnce();
  expect(screen.getByAltText('Denied')).toHaveAttribute('data-preview-state', 'failed');
  expect(screen.getByAltText('Denied').getAttribute('src')).toContain('Preview%20unavailable');
  first!.unmount(); api.get.mockResolvedValueOnce(response());
  await act(async () => { render(<StudioImage src="/api/preview/denied" loading="eager" alt="Reopened" />); });
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(screen.getByAltText('Reopened')).toHaveAttribute('data-preview-state', 'ready');
});
