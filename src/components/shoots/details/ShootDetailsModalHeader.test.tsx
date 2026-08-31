import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverflowRevealAddressTitle } from './OverflowRevealAddressTitle';

const compactAddress = '9137 Lakelandlley Court';
const fullAddress = '9137 Lakelandlley Court, Springfield, VA 22153';

const mockAddressMeasurements = (viewportWidth: number, textWidth: number) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function getClientWidth() {
    return this.getAttribute('data-testid') === 'shoot-address-reveal' ? viewportWidth : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function getScrollWidth() {
    return this.getAttribute('data-testid') === 'shoot-address-full' ? textWidth : 0;
  });
};

const renderAddressTitle = ({
  addressTitle = compactAddress,
  completeAddress = fullAddress,
}: {
  addressTitle?: string;
  completeAddress?: string | null;
} = {}) => render(
  <OverflowRevealAddressTitle
    compactAddress={addressTitle}
    fullAddress={completeAddress}
  />,
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShootDetailsModalHeader address reveal', () => {
  it('keeps a compact ellipsis preview while exposing the complete address accessibly', () => {
    mockAddressMeasurements(210, 430);
    renderAddressTitle();

    expect(screen.getByTestId('shoot-address-preview')).toHaveTextContent(`${compactAddress}…`);
    expect(screen.getByTestId('shoot-address-preview')).toHaveClass('truncate');

    const addressControl = screen.getByRole('button', { name: fullAddress });
    expect(addressControl).toHaveAttribute('title', fullAddress);
    expect(addressControl).toHaveAttribute('data-overflowing', 'true');
    expect(addressControl.closest('h2')).toHaveClass('min-w-0', 'max-w-[24rem]', 'flex-[0_1_auto]');
    expect(addressControl.closest('h2')).not.toHaveClass('flex-1');
  });

  it('slides only the full address layer on hover, focus, and pinned click', () => {
    mockAddressMeasurements(210, 430);
    renderAddressTitle();

    const addressControl = screen.getByRole('button', { name: fullAddress });
    const preview = screen.getByTestId('shoot-address-preview');
    const complete = screen.getByTestId('shoot-address-full');

    expect(complete).toHaveStyle({ transform: 'translateX(0)' });

    fireEvent.mouseEnter(addressControl);
    expect(preview).toHaveClass('opacity-0');
    expect(complete).toHaveClass(
      'opacity-100',
      'motion-reduce:!transform-none',
      'motion-reduce:opacity-0',
      'motion-reduce:transition-none',
    );
    expect(complete).toHaveStyle({ transform: 'translateX(-220px)' });
    expect(screen.getByRole('tooltip')).toHaveTextContent(fullAddress);
    expect(screen.getByRole('tooltip')).toHaveClass('hidden', 'motion-reduce:block');

    fireEvent.click(addressControl);
    expect(addressControl).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(addressControl);
    expect(addressControl).toHaveAttribute('aria-pressed', 'false');
    expect(complete).toHaveStyle({ transform: 'translateX(0)' });

    fireEvent.mouseLeave(addressControl);
    expect(complete).toHaveStyle({ transform: 'translateX(0)' });
    fireEvent.mouseEnter(addressControl);
    expect(complete).toHaveStyle({ transform: 'translateX(-220px)' });
    fireEvent.keyDown(addressControl, { key: 'Escape' });
    expect(complete).toHaveStyle({ transform: 'translateX(0)' });
    fireEvent.mouseLeave(addressControl);

    fireEvent.focus(addressControl);
    expect(complete).toHaveStyle({ transform: 'translateX(-220px)' });
    fireEvent.blur(addressControl);

    fireEvent.click(addressControl);
    expect(addressControl).toHaveAttribute('aria-pressed', 'true');
    expect(complete).toHaveStyle({ transform: 'translateX(-220px)' });
  });

  it('does not create a reveal interaction or movement for an address that already fits', () => {
    mockAddressMeasurements(240, 140);
    renderAddressTitle({ addressTitle: compactAddress, completeAddress: compactAddress });

    const addressViewport = screen.getByTestId('shoot-address-reveal');
    const complete = screen.getByTestId('shoot-address-full');

    expect(screen.getByTestId('shoot-address-preview')).toHaveTextContent(compactAddress);
    expect(addressViewport).toBeDisabled();
    expect(addressViewport).not.toHaveAttribute('aria-pressed');
    expect(addressViewport).toHaveAttribute('data-overflowing', 'false');

    fireEvent.mouseEnter(addressViewport);
    expect(complete).toHaveClass('opacity-0');
    expect(complete).toHaveStyle({ transform: 'translateX(0)' });
  });
});
