import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ServicePills } from './ServicePills';

describe('ServicePills', () => {
  it('renders the real empty state instead of a fabricated package', () => {
    render(<ServicePills shootId={12} items={[]} variant="desktop" />);

    expect(screen.getByText('No services')).toBeTruthy();
    expect(screen.queryByText(/standard package|general package/i)).toBeNull();
  });
});
