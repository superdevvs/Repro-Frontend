import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTourMediaDuplicateWarning } from './useTourMediaDuplicateWarning';

type Guard = ReturnType<typeof useTourMediaDuplicateWarning>;
type Candidate = Parameters<Guard['warnIfEmbedDuplicate']>[0];
const youtube = 'https://youtu.be/dQw4w9WgXcQ';
const youtubePlayer = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
const embed = { id: 'existing', title: 'Main walkthrough', branded: youtube, mls: '' };
const candidate: Candidate = { embeds: [], editingEmbedId: null, embedId: 'new', links: [youtubePlayer], title: 'New walkthrough' };

function WarningHarness({ attempt, onSave }: { attempt: (guard: Guard) => boolean; onSave: () => void }) {
  const guard = useTourMediaDuplicateWarning();
  return <>{guard.duplicateWarningDialog}<button onClick={() => { if (!attempt(guard)) onSave(); }}>Save</button></>;
}

afterEach(cleanup);

describe('tour editor duplicate warning', () => {
  it('blocks a normalized embed duplicate of the listing video and dismisses the warning', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<WarningHarness onSave={onSave} attempt={(guard) => guard.warnIfEmbedDuplicate({ ...candidate, videoLink: youtube })} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('the listing Video Link');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it.each(['branded', 'mls'] as const)('blocks another embed matching the %s URL', async (field) => {
    const onSave = vi.fn();
    const existing = { ...embed, branded: '', mls: '', [field]: 'https://vimeo.com/123456789' };
    render(<WarningHarness onSave={onSave} attempt={(guard) => guard.warnIfEmbedDuplicate({
      ...candidate, embeds: [existing], links: ['https://player.vimeo.com/video/123456789'],
    })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Main walkthrough');
  });

  it('allows editing an embed without treating its own URL as a duplicate', async () => {
    const onSave = vi.fn();
    render(<WarningHarness onSave={onSave} attempt={(guard) => guard.warnIfEmbedDuplicate({
      ...candidate, embeds: [embed], editingEmbedId: embed.id, embedId: embed.id,
    })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('preserves the existing HTML-snippet exemption', async () => {
    const onSave = vi.fn();
    render(<WarningHarness onSave={onSave} attempt={(guard) => guard.warnIfEmbedDuplicate({
      ...candidate, videoLink: youtube, links: [`<iframe src="${youtubePlayer}"></iframe>`],
    })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('blocks a listing Video Link matching an existing Virtual Tours embed', async () => {
    const onSave = vi.fn();
    render(<WarningHarness onSave={onSave} attempt={(guard) => guard.warnIfVideoDuplicate(youtubePlayer, [embed])} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Remove the duplicate Virtual Tours embed first');
  });

  it('allows a different listing video', async () => {
    const onSave = vi.fn();
    render(<WarningHarness onSave={onSave} attempt={(guard) => guard.warnIfVideoDuplicate('https://vimeo.com/123456789', [embed])} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
