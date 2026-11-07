import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NeoTour } from './NeoTour';

const scroll = vi.hoisted(() => ({ handler: (_value: number) => {} }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useMotionValueEvent: (_value: unknown, _event: string, handler: (value: number) => void) => { scroll.handler = handler; } };
});

beforeEach(() => {
  window.history.replaceState({}, '', '/tour/branded?shootId=42');
  vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn(); });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('keeps the active section aligned with the rendered floorplan and property section order', async () => {
  const { container } = render(<NeoTour initialData={{
    shoot: { id: 42, address: '42 Redwood Avenue' },
    photos: ['https://media.test/photo.jpg'],
    floorplans: [{ image: 'https://media.test/plan.jpg' }],
    video_link: 'https://www.youtube.com/watch?v=abcdefghijk',
    tour_links: { embeds: [{ id: 'custom', title: 'Custom tour', branded: 'https://viewer.test/tour' }] },
  }} />);
  await screen.findByRole('button', { name: 'Floor Plans' });
  const positions: Record<string, number> = { floorplan: -2000, embeds: -1600, header: -1200, gallery: -800, details: 100, video: 900, contact: 1600 };
  for (const id of Object.keys(positions)) {
    const section = container.querySelector(`#${id}`);
    expect(section).not.toBeNull();
    const element = id === 'floorplan' ? section!.parentElement! : section!;
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => ({ top: positions[id] } as DOMRect));
  }
  act(() => scroll.handler(2000));
  expect(screen.getByRole('button', { name: 'Details' })).toHaveClass('bg-blue-500');
  expect(screen.getByRole('button', { name: 'Floor Plans' })).not.toHaveClass('bg-blue-500');

  Object.assign(positions, { floorplan: 100, embeds: 900, header: 1400, gallery: 1900, details: 2300, video: 2900, contact: 3500 });
  act(() => scroll.handler(100));
  expect(screen.getByRole('button', { name: 'Floor Plans' })).toHaveClass('bg-blue-500');
});
