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
  it('keeps the link field full width with the actions in one menu on phones and inline on wider screens', () => {
    render(<TourLinkRow label="Branded Tour Link" value="https://example.com/t/1" actions={actions()} />);

    const input = screen.getByDisplayValue('https://example.com/t/1');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveClass('min-w-0', 'flex-1');

    // One trigger for phones, hidden from sm up; the inline group is the reverse.
    const menuTrigger = screen.getByRole('button', { name: 'Branded Tour Link actions' });
    expect(menuTrigger).toHaveClass('sm:hidden');
    expect(screen.getByTestId('tour-link-inline-actions')).toHaveClass('hidden', 'sm:flex');
    expect(screen.getByTestId('tour-link-inline-actions').querySelectorAll('button')).toHaveLength(3);
  });

  it('runs the chosen action from the menu and respects disabled entries', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    render(<TourLinkRow label="MLS Link" value="https://example.com/t/2" actions={actions(onCopy)} />);

    await user.click(screen.getByRole('button', { name: 'MLS Link actions' }));

    expect(await screen.findByRole('menuitem', { name: /Open in new tab/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('menuitem', { name: /Copy link/ }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('shows the placeholder when nothing is set', () => {
    render(<TourLinkRow label="Walkthrough" value="" placeholder="No video set" actions={actions()} />);
    expect(screen.getByPlaceholderText('No video set')).toBeInTheDocument();
  });
});
