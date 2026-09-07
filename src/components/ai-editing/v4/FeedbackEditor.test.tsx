import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackEditor } from './FeedbackEditor';
import type { V4Feedback } from '@/components/studio/v4/types';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  localStorage.setItem('authToken', crypto.randomUUID());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('suggested-area photo feedback', () => {
  it('sends at most four existing workspace reference IDs and preserves them after a failed request', async () => {
    const media = Array.from({ length: 5 }, (_, index) => ({ id: `ref-${index}`, name: `Reference ${index + 1}`, kind: 'image' as const, url: 'https://media.test/reference.jpg', thumbnailUrl: 'https://media.test/reference.jpg' }));
    const onSubmit = vi.fn().mockRejectedValue(new Error('Try again.'));
    render(<FeedbackEditor mediaId="base" name="Living room" imageUrl="https://media.test/living.jpg" busy={false} referenceMedia={media} referenceImagesEnabled onDetect={vi.fn()} onSubmit={onSubmit} onClose={vi.fn()} />);
    screen.getByText('Reference photos · 0 of 4').closest('details')!.open = true;
    for (let index = 0; index < 4; index++) fireEvent.click(screen.getByRole('button', { name: `Reference Reference ${index + 1}` }));
    expect(screen.getByRole('button', { name: 'Reference Reference 5' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Describe the change'), { target: { value: 'Match the lighting in the reference photos.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate revision' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ referenceMediaIds: ['ref-0', 'ref-1', 'ref-2', 'ref-3'] })));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again.');
    expect(screen.getByRole('button', { name: 'Reference Reference 1' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('cannot submit a revision when its service is unavailable', () => {
    const onSubmit = vi.fn();
    render(<FeedbackEditor mediaId="base" name="Living room" imageUrl="https://media.test/living.jpg" busy={false} revisionReady={false} unavailableReason="Revisions are not configured." onDetect={vi.fn()} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Describe the change'), { target: { value: 'Improve the ceiling.' } });
    expect(screen.getByRole('button', { name: 'Generate revision' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('detects once, exposes image overlay selection, focuses feedback, and submits the selected normalized box', async () => {
    const region = { x: .2, y: .1, width: .3, height: .4 };
    const onDetect = vi.fn().mockResolvedValue([{ id: 'window', label: 'Window', region }]);
    const onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn();
    render(<FeedbackEditor mediaId="photo-a" name="Living room" imageUrl="https://media.test/living.jpg" busy={false} detectOnOpen onDetect={onDetect} onSubmit={onSubmit} onClose={onClose} />);
    const overlay = await screen.findByRole('button', { name: 'Select suggested Window area' });
    expect(overlay).toHaveStyle({ left: '20%', top: '10%', width: '30%', height: '40%' });
    fireEvent.click(overlay);
    const prompt = screen.getByLabelText('Describe the change');
    expect(prompt).toHaveFocus();
    expect(overlay).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Find objects' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Find objects' })).not.toBeDisabled());
    expect(onDetect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Generate revision' })).toBeDisabled();
    fireEvent.change(prompt, { target: { value: 'Keep the window proportions and recover the view.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate revision' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mediaId: 'photo-a', prompt: 'Keep the window proportions and recover the view.', region, drawing: [] }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps user feedback intact after a failed revision request', async () => {
    const onClose = vi.fn();
    render(<FeedbackEditor mediaId="photo-b" name="Bathroom" imageUrl="https://media.test/bath.jpg" busy={false} onDetect={vi.fn()} onSubmit={vi.fn().mockRejectedValue(new Error('Provider unavailable'))} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Describe the change'), { target: { value: 'Remove the reflection, preserve the mirror.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate revision' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable');
    expect(screen.getByLabelText('Describe the change')).toHaveValue('Remove the reflection, preserve the mirror.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submits a complete long gesture within API limits and stops at 20 retained strokes until Undo', async () => {
    const onSubmit = vi.fn<(feedback: V4Feedback) => Promise<void>>().mockResolvedValue(undefined);
    render(<FeedbackEditor mediaId="drawing-a" name="Kitchen" imageUrl="https://media.test/kitchen.jpg" busy={false} onDetect={vi.fn()} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw' }));
    const surface = screen.getByLabelText('Draw feedback on the image');
    surface.setPointerCapture = vi.fn();
    surface.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, toJSON: () => ({}) });
    const point = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      fireEvent(surface, event);
    };
    point('pointerdown', 0, 0);
    act(() => { for (let i = 1; i <= 600; i++) point('pointermove', i / 600 * 1000, 0); for (let i = 1; i <= 600; i++) point('pointermove', 1000, i / 600 * 1000); });
    point('pointerup', 1000, 1000);
    for (let i = 1; i < 20; i++) { point('pointerdown', 100, 200); point('pointermove', 300, 400); point('pointerup', 300, 400); }
    expect(screen.getByRole('status')).toHaveTextContent('20 strokes added. Undo a stroke to draw more.');
    point('pointerdown', 500, 500); point('pointermove', 600, 600); point('pointerup', 600, 600);
    expect(screen.getByRole('status')).toHaveTextContent('20 strokes added.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('status')).toHaveTextContent('19 of 20 strokes used');
    point('pointerdown', 600, 600); point('pointerup', 700, 700);
    fireEvent.change(screen.getByLabelText('Describe the change'), { target: { value: 'Clean up the marked cabinet edges.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate revision' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0].drawing!;
    expect(submitted).toHaveLength(20);
    expect(submitted.every(stroke => stroke.length <= 200)).toBe(true);
    expect(submitted[0]).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
    expect(submitted[19]).toEqual([{ x: .6, y: .6 }, { x: .7, y: .7 }]);
  });
});
