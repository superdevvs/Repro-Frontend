import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Copy, ExternalLink, Trash } from 'lucide-react';
import { TourLinkRow } from './TourLinkRow';

afterEach(() => cleanup());

const actions = (onCopy = vi.fn(), onRemove = vi.fn()) => [
  { key: 'copy', label: 'Copy link', icon: Copy, onSelect: onCopy },
  { key: 'open', label: 'Open in new tab', icon: ExternalLink, onSelect: vi.fn(), disabled: true },
  { key: 'remove', label: 'Remove link', icon: Trash, onSelect: onRemove, destructive: true },
];

describe('TourLinkRow', () => {
  it('keeps copy beside the kebab on phones and hides extra actions until the menu opens', () => {
    render(<TourLinkRow label="Branded Tour Link" value="https://example.com/t/1" actions={actions()} />);

    const input = screen.getByDisplayValue('https://example.com/t/1');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveClass('min-w-0');

    const mobileCopy = screen.getByTestId('tour-link-mobile-copy');
    expect(mobileCopy).toHaveClass('sm:hidden');
    expect(screen.getByRole('button', { name: 'Branded Tour Link actions' })).toBeInTheDocument();
    expect(screen.queryByTestId('tour-link-inline-actions')).not.toBeInTheDocument();
  });

  it('copies from the dedicated mobile button and still offers copy in the menu', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<TourLinkRow label="MLS Link" value="https://example.com/t/2" actions={actions(onCopy)} />);

    await user.click(screen.getByTestId('tour-link-mobile-copy'));
    expect(onCopy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'MLS Link actions' }));
    expect(await screen.findByRole('menuitem', { name: /Open in new tab/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('menuitem', { name: /Copy link/ }));
    expect(onCopy).toHaveBeenCalledTimes(2);
  });

  it('shows a hover copy overlay on the right edge of the field on desktop', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<TourLinkRow label="Walkthrough" value="https://example.com/t/3" actions={actions(onCopy)} />);

    const overlay = screen.getByTestId('tour-link-hover-copy');
    expect(overlay).toHaveClass('hidden', 'sm:flex');
    await user.click(overlay);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('shows the placeholder when nothing is set', () => {
    render(<TourLinkRow label="Walkthrough" value="" placeholder="No video set" actions={actions()} />);
    expect(screen.getByPlaceholderText('No video set')).toBeInTheDocument();
  });
});
