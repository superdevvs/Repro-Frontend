import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalCommandBar } from './GlobalCommandBar';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
  if (!proto.hasPointerCapture) proto.hasPointerCapture = vi.fn(() => false);
  if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
  if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
  if (!('ResizeObserver' in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const useShootSearch = vi.fn();

vi.mock('@/hooks/useShootSearch', () => ({
  useShootSearch: (...args: unknown[]) => useShootSearch(...args),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: 'admin' }),
}));

vi.mock('@/context/shootsContextState', () => ({
  useOptionalShoots: () => ({ fetchShoots: vi.fn() }),
}));

vi.mock('@/hooks/useEditingRequests', () => ({
  useEditingRequests: () => ({ requests: [] }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GlobalCommandBar shared shoot search', () => {
  it('wires the shared hook with typed query and renders server hits', async () => {
    useShootSearch.mockImplementation(({ query }: { query: string }) => {
      const trimmed = query.trim();
      if (trimmed === '42') {
        return {
          shoots: [
            {
              id: '42',
              status: 'scheduled',
              location: { address: '100 Main St', fullAddress: '100 Main St' },
              client: { name: 'Acme' },
            },
          ],
          count: 1,
          isLoading: false,
          error: null,
          hasResolved: true,
        };
      }
      return {
        shoots: [],
        count: 0,
        isLoading: false,
        error: null,
        hasResolved: false,
      };
    });

    render(<GlobalCommandBar open onOpenChange={vi.fn()} />);

    expect(useShootSearch).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false, query: '' }),
    );

    const input = screen.getByPlaceholderText(/search or run a command/i);
    await userEvent.type(input, '42');

    expect(useShootSearch).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, query: '42' }),
    );
    expect(await screen.findByText('Shoot #42')).toBeTruthy();
    expect(screen.getByText('100 Main St')).toBeTruthy();
  });

  it('shows truthful empty copy on resolved miss (not an error)', async () => {
    useShootSearch.mockImplementation(({ query, enabled }: { query: string; enabled: boolean }) => ({
      shoots: [],
      count: 0,
      isLoading: false,
      error: null,
      hasResolved: Boolean(enabled && query.trim()),
    }));

    render(<GlobalCommandBar open onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/search or run a command/i), 'zzzz');
    expect(await screen.findByText(/no results found/i)).toBeTruthy();
  });

  it('keeps shoot search errors visible instead of empty hits', async () => {
    useShootSearch.mockImplementation(({ query, enabled }: { query: string; enabled: boolean }) => ({
      shoots: [],
      count: 0,
      isLoading: false,
      error: enabled && query.trim() ? new Error('Unavailable') : null,
      hasResolved: Boolean(enabled && query.trim()),
    }));

    render(<GlobalCommandBar open onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/search or run a command/i), 'main');

    expect(await screen.findByText(/shoot search failed/i)).toBeTruthy();
    expect(screen.queryByText(/no results found/i)).toBeNull();
  });

  it('does not enable the shared search for whitespace-only input', async () => {
    useShootSearch.mockReturnValue({
      shoots: [],
      count: 0,
      isLoading: false,
      error: null,
      hasResolved: false,
    });

    render(<GlobalCommandBar open onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/search or run a command/i), '   ');

    const enabledCalls = useShootSearch.mock.calls.filter(
      ([args]) => args && (args as { enabled?: boolean }).enabled === true,
    );
    expect(enabledCalls).toHaveLength(0);
  });
});
