import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PhotoComparison } from './PhotoComparison';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const props = { name: 'Exterior', originalUrl: '/original.jpg', editedUrl: '/edited.jpg', version: 2, generating: false, mode: 'compare' as const, onModeChange: vi.fn(), position: 50, onPositionChange: vi.fn() };

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
  fireEvent.click(screen.getByRole('button', { name: 'Before' }));
  expect(props.onModeChange).toHaveBeenCalledWith('before');
});

it('disables result modes until an edited photo is available', () => {
  render(<PhotoComparison {...props} editedUrl={undefined} mode="before" />);
  expect(screen.getByRole('button', { name: 'After' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Compare' })).toBeDisabled();
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});
