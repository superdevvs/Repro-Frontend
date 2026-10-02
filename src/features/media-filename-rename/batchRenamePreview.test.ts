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

  it('previews the cleaned address for all 125 RAW files', () => {
    const names = Array.from({ length: 125 }, (_, index) => `SNAP${5129 + index}.CR3`);
    expect(previewBatchRenameFilenames(names, {
      mode: 'replace',
      find: 'SNAP',
      replace: '18502 Boysenberry Dr 156, Gaithersburg, MD_',
    })).toEqual(names.map((_, index) => `18502 Boysenberry Dr 156 Gaithersburg MD_${5129 + index}.CR3`));
  });

  it('cleans punctuation and path syntax in every rename mode', () => {
    const names = ['IMG_1.jpg'];
    expect(previewBatchRenameFilenames(names, { mode: 'prefix', value: '../Room,:/' })).toEqual(['RoomIMG_1.jpg']);
    expect(previewBatchRenameFilenames(names, { mode: 'suffix', value: ',*?\\' })).toEqual(names);
    expect(previewBatchRenameFilenames(names, { mode: 'sequence', value: 'Café [2],', separator: '/', digits: 2 })).toEqual(['Café [2]01.jpg']);
  });

  it('does not turn an empty cleaned stem into a filename made from its extension', () => {
    expect(previewBatchRenameFilenames(['SNAP.CR3'], { mode: 'replace', find: 'SNAP', replace: ',/?*' })).toEqual(['']);
  });
});
