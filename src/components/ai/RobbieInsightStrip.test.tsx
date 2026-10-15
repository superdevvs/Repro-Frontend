import React, { Profiler } from 'react';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RobbieInsightStrip } from './RobbieInsightStrip';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), navigate: vi.fn(), reducedMotion: false }));
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ role: 'admin', session: { accessToken: 'token', user: { id: '1' } } }),
}));
vi.mock('react-router-dom', async original => ({
  ...await original<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate,
}));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mocks.reducedMotion }));
vi.mock('@/services/robbieInsightsService', () => ({
  fetchRobbieInsights: mocks.fetch, INSIGHTS_REFRESH_MS: 60_000,
}));
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props} />,
  },
}));

const insights = [
  { id: 'one', priority: 'blocking', message: 'A complete message about a shoot needing attention.', prompt: 'Show shoot one', action: 'Open shoot' },
  { id: 'two', priority: 'insight', message: 'A second complete insight about upcoming work.', prompt: 'Show shoot two' },
];
let observerCallback: IntersectionObserverCallback;
let observedNode: Element;
let pageHidden = false;

function setInView(visible: boolean) {
  act(() => observerCallback([{ target: observedNode, isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver));
}

function setHidden(hidden: boolean) {
  pageHidden = hidden;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
}

async function settle() {
  await act(async () => { await Promise.resolve(); });
}

function mount(onRender = vi.fn()) {
  return render(<MemoryRouter initialEntries={['/dashboard']}><Profiler id="insights" onRender={onRender}><RobbieInsightStrip /></Profiler></MemoryRouter>);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  pageHidden = false;
  mocks.reducedMotion = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => pageHidden);
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { observerCallback = callback; }
    observe(node: Element) { observedNode = node; }
    disconnect() {}
  });
  mocks.fetch.mockResolvedValue({ insights, error: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Robbie insight idle work', () => {
  it('shows the complete message without repeated character renders', async () => {
    const onRender = vi.fn();
    mount(onRender);
    setInView(true);
    await settle();
    expect(screen.getByText(insights[0].message)).toBeInTheDocument();
    const renderCount = onRender.mock.calls.length;
    act(() => vi.advanceTimersByTime(1000));
    expect(onRender).toHaveBeenCalledTimes(renderCount);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText(insights[1].message)).toBeInTheDocument();
  });

  it('stops refresh and rotation offscreen, then resumes when visible', async () => {
    mount();
    expect(mocks.fetch).not.toHaveBeenCalled();
    setInView(true);
    await settle();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    setInView(false);
    act(() => vi.advanceTimersByTime(120_000));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(insights[0].message)).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    setInView(true);
    await settle();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(insights[1].message)).toBeInTheDocument();
  });

  it('stops all strip timers while the browser tab is hidden and refreshes on return', async () => {
    mount();
    setInView(true);
    await settle();
    setHidden(true);
    act(() => vi.advanceTimersByTime(120_000));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByText(insights[0].message)).toBeInTheDocument();
    setHidden(false);
    await settle();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(insights[1].message)).toBeInTheDocument();
  });

  it('keeps insight actions and typed questions working', async () => {
    mount();
    setInView(true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: `Robbie insight: ${insights[0].message}` }));
    expect(mocks.navigate).toHaveBeenLastCalledWith('/chat-with-reproai', {
      state: expect.objectContaining({ initialMessage: insights[0].prompt, context: expect.objectContaining({ insightId: 'one', page: 'dashboard' }) }),
    });
    fireEvent.click(screen.getByText(insights[0].message));
    const input = screen.getByRole('textbox', { name: 'Ask Robbie anything' });
    fireEvent.change(input, { target: { value: 'Help with my next shoot' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mocks.navigate).toHaveBeenLastCalledWith('/chat-with-reproai', {
      state: expect.objectContaining({ initialMessage: 'Help with my next shoot', context: expect.objectContaining({ mode: 'general' }) }),
    });
  });

  it('keeps reduced-motion insights static', async () => {
    mocks.reducedMotion = true;
    mount();
    setInView(true);
    await settle();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText(insights[0].message)).toBeInTheDocument();
    expect(screen.queryByText(insights[1].message)).not.toBeInTheDocument();
  });
});
