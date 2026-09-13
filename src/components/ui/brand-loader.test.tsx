import React, { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrandLoader } from './brand-loader';
import { ScanStatusBadge } from '@/components/shoots/tabs/media/ScanStatusBadge';

afterEach(cleanup);

describe('BrandLoader', () => {
  it('provides a named loading status and preserves SVG icon sizing and refs', () => {
    const ref = createRef<SVGSVGElement>();
    render(<BrandLoader ref={ref} size={40} label="Loading shoots" className="mr-2 h-10 w-10 animate-spin" />);
    const status = screen.getByRole('status', { name: 'Loading shoots' });
    expect(ref.current).toBe(status);
    expect(status).toHaveAttribute('width', '40');
    expect(status).toHaveClass('mr-2', 'h-10', 'w-10');
    expect(status).not.toHaveClass('animate-spin');
  });

  it('supplies a complete static mark for reduced motion without duplicating announcements', () => {
    const { container } = render(<BrandLoader aria-hidden="true" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const animated = container.querySelector('image[href="/brand/re/loading.svg"]');
    const still = container.querySelector('image[href="/brand/re/loading-static.svg"]');
    expect(animated).toHaveClass('motion-reduce:hidden');
    expect(still).toHaveClass('hidden', 'motion-reduce:block');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('preserves scan retry behavior while replacing only its busy indicator', () => {
    const onRetry = vi.fn();
    const { container, rerender } = render(<ScanStatusBadge status="failed" onRetry={onRetry} />);
    const retry = screen.getByRole('button', { name: 'Retry virus scan' });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(container.querySelector('image[href="/brand/re/loading.svg"]')).not.toBeInTheDocument();

    rerender(<ScanStatusBadge status="failed" onRetry={onRetry} isRetrying />);
    expect(retry).toBeDisabled();
    expect(screen.getByText('Retrying…')).toBeInTheDocument();
    expect(container.querySelector('image[href="/brand/re/loading.svg"]')).toBeInTheDocument();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<ScanStatusBadge status="clean" onRetry={onRetry} />);
    expect(screen.getByText('Clean')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry virus scan' })).not.toBeInTheDocument();
    expect(container.querySelector('image[href="/brand/re/loading.svg"]')).not.toBeInTheDocument();
  });
});
