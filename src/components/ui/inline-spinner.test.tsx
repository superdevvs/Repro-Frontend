import React, { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { InlineSpinner } from './inline-spinner';

afterEach(cleanup);

describe('InlineSpinner', () => {
  it('keeps downloads compact, names their status and supports reduced motion', () => {
    const ref = createRef<SVGSVGElement>();
    const { container } = render(<InlineSpinner ref={ref} size={16} className="h-4 w-4" label="Downloading photos" />);
    const spinner = screen.getByRole('status', { name: 'Downloading photos' });
    expect(ref.current).toBe(spinner);
    expect(spinner).toHaveAttribute('width', '16');
    expect(spinner).toHaveClass('h-4', 'w-4', 'animate-spin', 'motion-reduce:animate-none');
    expect(container.querySelector('image')).not.toBeInTheDocument();
    expect(container.querySelector('[data-page-loading]')).not.toBeInTheDocument();
  });

  it('preserves button labels when the spinner is decorative', () => {
    render(<button disabled><InlineSpinner aria-hidden="true" className="h-4 w-4" />Downloading</button>);
    expect(screen.getByRole('button', { name: 'Downloading' })).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
