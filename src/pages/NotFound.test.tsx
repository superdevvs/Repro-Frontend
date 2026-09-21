import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

const renderPage = (path = '/missing-route') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NotFound />
    </MemoryRouter>,
  );

describe('NotFound', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the blueprint 404 with homepage and services links', () => {
    const { container } = renderPage();

    expect(screen.getByRole('heading', { name: 'This page is under a different plan' })).toBeInTheDocument();
    expect(screen.getByText('It might have been moved, renamed, or doesn’t exist.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Homepage' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Explore Our Services' })).toHaveAttribute(
      'href',
      'https://reprophotos.com/services/',
    );
    expect(container.querySelector('svg[viewBox="0 0 1040 400"]')).not.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      '404 Error: User attempted to access non-existent route:',
      expect.any(String),
    );
  });

  it('defaults to dark and can switch to light without changing the document theme class', () => {
    const { container } = renderPage();
    const page = container.querySelector('.not-found');

    expect(page).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.classList.contains('light')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));

    expect(page).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
