import { describe, expect, it } from 'vitest';
import { previewBatchRenameFilenames } from './batchRenamePreview';

describe('previewBatchRenameFilenames', () => {
  it('applies prefix/suffix/replace/sequence', () => {
    const names = ['IMG_1.jpg', 'IMG_2.jpg'];
    expect(previewBatchRenameFilenames(names, { mode: 'prefix', value: 'Kitchen-' })).toEqual([
      'Kitchen-IMG_1.jpg',
      'Kitchen-IMG_2.jpg',
    ]);
    expect(previewBatchRenameFilenames(names, { mode: 'suffix', value: '-final' })).toEqual([
      'IMG_1-final.jpg',
      'IMG_2-final.jpg',
    ]);
    expect(previewBatchRenameFilenames(names, { mode: 'replace', find: 'IMG_', replace: 'Room-' })).toEqual([
      'Room-1.jpg',
      'Room-2.jpg',
    ]);
    expect(previewBatchRenameFilenames(names, { mode: 'sequence', value: 'Kitchen', start: 1, digits: 2, separator: '-' })).toEqual([
      'Kitchen-01.jpg',
      'Kitchen-02.jpg',
    ]);
  });
});
