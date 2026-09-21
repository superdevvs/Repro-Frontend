import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmailHealthBadge } from './EmailHealthBadge';

describe('EmailHealthBadge', () => {
  afterEach(cleanup);

  it('shows mail plus tick for verified status without pill text', () => {
    render(<EmailHealthBadge emailHealth={{ status: 'verified' }} />);
    const badge = screen.getByLabelText('Verified');
    expect(badge).toBeInTheDocument();
    expect(badge).not.toHaveTextContent('Verified');
  });

  it('shows mail plus x for unverified status without pill text', () => {
    render(<EmailHealthBadge emailHealth={{ status: 'unverified' }} />);
    const badge = screen.getByLabelText('Unverified');
    expect(badge).toBeInTheDocument();
    expect(badge).not.toHaveTextContent('Unverified');
  });

  it('accepts a verified boolean when email health is not available', () => {
    render(<EmailHealthBadge verified={false} />);
    expect(screen.getByLabelText('Unverified')).toBeInTheDocument();
  });
});
