import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UploadCompleteArtwork } from './UploadCompleteArtwork';

afterEach(cleanup);

describe('completion artwork across multiple summaries and dialogs', () => {
  it('keeps clip references local to each artwork and stable when time labels refresh', () => {
    const { container, rerender } = render(<><UploadCompleteArtwork animate /><UploadCompleteArtwork animate /></>);
    const ids = () => Array.from(container.querySelectorAll('[id]')).map(element => element.id);
    const before = ids();
    expect(before.length).toBeGreaterThan(1);
    expect(new Set(before).size).toBe(before.length);
    container.querySelectorAll('.upload-complete-photos').forEach(art => {
      art.querySelectorAll('[clip-path]').forEach(element => {
        const target = element.getAttribute('clip-path')?.match(/url\(#([^)]+)\)/)?.[1];
        expect(Array.from(art.querySelectorAll('[id]')).some(element => element.id === target)).toBe(true);
      });
    });
    rerender(<><UploadCompleteArtwork animate={false} /><UploadCompleteArtwork animate={false} /></>);
    expect(ids()).toEqual(before);
  });
});
