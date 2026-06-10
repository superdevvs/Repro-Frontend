/**
 * Unit tests for the ScanStatusBadge component (Req 15.5, 15.8).
 *
 * Verifies that the badge renders the correct label for each canonical
 * scan_status value, that the retry-scan control only appears for `failed`
 * files, and that the in-flight state disables the retry button so a single
 * click cannot trigger duplicate rescan dispatches.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ScanStatusBadge } from './ScanStatusBadge';

afterEach(() => {
  cleanup();
});

describe('ScanStatusBadge', () => {
  it('renders nothing when status is null or undefined', () => {
    const { container, rerender } = render(<ScanStatusBadge status={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ScanStatusBadge status={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "Scanning" for quarantined files', () => {
    render(<ScanStatusBadge status="quarantined" />);
    expect(screen.getByLabelText('Scan status: Scanning')).toBeInTheDocument();
    expect(screen.getByText('Scanning')).toBeInTheDocument();
  });

  it('renders "Clean" for clean files', () => {
    render(<ScanStatusBadge status="clean" />);
    expect(screen.getByLabelText('Scan status: Clean')).toBeInTheDocument();
    expect(screen.getByText('Clean')).toBeInTheDocument();
  });

  it('renders "Infected" for infected files', () => {
    render(<ScanStatusBadge status="infected" />);
    expect(screen.getByLabelText('Scan status: Infected')).toBeInTheDocument();
    expect(screen.getByText('Infected')).toBeInTheDocument();
  });

  it('renders "Scan failed" for failed files', () => {
    render(<ScanStatusBadge status="failed" />);
    expect(screen.getByLabelText('Scan status: Scan failed')).toBeInTheDocument();
    expect(screen.getByText('Scan failed')).toBeInTheDocument();
  });

  it('does not show a retry-scan control for non-failed statuses', () => {
    const onRetry = vi.fn();
    const statuses = ['quarantined', 'clean', 'infected'] as const;

    for (const status of statuses) {
      const { unmount } = render(
        <ScanStatusBadge status={status} onRetry={onRetry} />,
      );
      expect(screen.queryByTestId('retry-scan-button')).toBeNull();
      unmount();
    }

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('shows the retry-scan control only when status is failed and onRetry is provided', () => {
    const { rerender } = render(<ScanStatusBadge status="failed" />);
    // No retry handler — no button.
    expect(screen.queryByTestId('retry-scan-button')).toBeNull();

    rerender(<ScanStatusBadge status="failed" onRetry={() => {}} />);
    expect(screen.getByTestId('retry-scan-button')).toBeInTheDocument();
  });

  it('invokes the onRetry callback when the retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ScanStatusBadge status="failed" onRetry={onRetry} />);

    fireEvent.click(screen.getByTestId('retry-scan-button'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables the retry button while a rescan is in flight', () => {
    const onRetry = vi.fn();
    render(
      <ScanStatusBadge status="failed" onRetry={onRetry} isRetrying />,
    );

    const button = screen.getByTestId('retry-scan-button');
    expect(button).toBeDisabled();
    // Label switches to a disabled "Retrying…" state so the user knows the
    // earlier click is still being processed (Req 15.8 — disable while in
    // flight).
    expect(button).toHaveTextContent(/retrying/i);

    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('does not propagate the click event to ancestor elements', () => {
    // The badge is rendered inside file tiles whose root onClick opens the
    // viewer (MediaGrid `onFileClick`). The retry button must stop both
    // propagation and the default action so a stray viewer-open does not
    // race with the rescan mutation.
    const onRetry = vi.fn();
    const onAncestorClick = vi.fn();

    render(
      <div onClick={onAncestorClick} data-testid="ancestor">
        <ScanStatusBadge status="failed" onRetry={onRetry} />
      </div>,
    );

    fireEvent.click(screen.getByTestId('retry-scan-button'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onAncestorClick).not.toHaveBeenCalled();
  });
});
