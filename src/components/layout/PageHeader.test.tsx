import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('keeps a compact title on phones and hides the description until desktop', () => {
    render(
      <PageHeader
        title="Scheduling Catalog"
        description="Manage services and client-specific service visibility."
        compactTitleOnMobile
      />,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveClass('truncate', 'text-lg', 'md:text-3xl');
    expect(screen.getByText('Scheduling Catalog')).toBeInTheDocument();
    expect(screen.getByText('Scheduling')).toBeInTheDocument();
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText(/manage services/i)).toHaveClass('hidden', 'md:block');
  });
});
