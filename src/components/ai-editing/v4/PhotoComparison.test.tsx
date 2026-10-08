import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PhotoComparison } from './PhotoComparison';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const props = { name: 'Exterior', originalUrl: '/original.jpg', editedUrl: '/edited.jpg', version: 2, generating: false, comparing: true, position: 50, onPositionChange: vi.fn() };

it('bounds the comparison to the contained photo and exposes its position for keyboard users', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
  const { container } = render(<PhotoComparison {...props} />);
  const edited = screen.getByAltText('Exterior edited');
  Object.defineProperties(edited, { naturalWidth: { value: 1600 }, naturalHeight: { value: 900 } });
  fireEvent.load(edited);
  expect(container.querySelector('.v4-photo-image-frame')).toHaveStyle({ width: '1000px', height: '562.5px' });
  const slider = screen.getByRole('slider', { name: 'Before and after comparison position' });
  expect(slider).toHaveAttribute('aria-valuetext', '50% original image visible');
  fireEvent.change(slider, { target: { value: '70' } });
  expect(props.onPositionChange).toHaveBeenCalledWith(70);
  expect(screen.queryByRole('button', { name: 'Compare' })).not.toBeInTheDocument();
});

it('shows the original without comparison controls until an edited photo is available', () => {
  render(<PhotoComparison {...props} editedUrl={undefined} comparing={false} />);
  expect(screen.queryByRole('button', { name: 'After' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Before' })).not.toBeInTheDocument();
  expect(screen.getByAltText('Exterior original')).toBeVisible();
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});

it('clips the full-size original container so different image ratios cannot expose the edit on the before side', () => {
  const { container, rerender } = render(<PhotoComparison {...props} position={70} />);
  const original = screen.getByAltText('Original for comparison');
  expect(original).toHaveAttribute('loading', 'eager');
  expect(original.parentElement).toHaveClass('v4-photo-original-clip');
  expect(original.parentElement).toHaveStyle({ clipPath: 'inset(0 30% 0 0)' });
  rerender(<PhotoComparison {...props} position={0} />);
  expect(container.querySelector('.v4-photo-original-clip')).toHaveStyle({ clipPath: 'inset(0 100% 0 0)' });
});
