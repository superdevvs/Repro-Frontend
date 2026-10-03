import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DecodedViewerImage } from './DecodedViewerImage';

afterEach(cleanup);
it('reuses the decoded node without assigning its protected URL again, including reverse navigation', () => {
  const first = document.createElement('img');
  const second = document.createElement('img');
  first.src = '/authorized-first.jpg'; second.src = '/authorized-second.jpg';
  const firstSource = vi.spyOn(first, 'src', 'set');
  const secondSource = vi.spyOn(second, 'src', 'set');
  const view = render(<DecodedViewerImage image={first} filename="First" className="object-contain" />);
  expect(view.getByRole('img')).toBe(first);
  view.rerender(<DecodedViewerImage image={second} filename="Second" className="object-contain" />);
  expect(view.getByRole('img')).toBe(second);
  expect(first.isConnected).toBe(false);
  view.rerender(<DecodedViewerImage image={first} filename="First" className="object-contain" />);
  expect(view.getByRole('img')).toBe(first);
  expect(firstSource).not.toHaveBeenCalled();
  expect(secondSource).not.toHaveBeenCalled();
});

it('removes the old rendition immediately on revocation or while a new photo is unavailable', () => {
  const original = document.createElement('img');
  original.src = '/original.jpg';
  const view = render(<DecodedViewerImage image={original} filename="Original" className="object-contain" />);
  view.rerender(<DecodedViewerImage image={undefined} filename="Next photo" className="object-contain" />);
  expect(view.queryByRole('img')).toBeNull();
  expect(original.isConnected).toBe(false);
});
