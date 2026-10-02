import { describe, expect, it } from 'vitest';
import { previewBatchRenameFilenames } from './batchRenamePreview';

describe('previewBatchRenameFilenames', () => {
  const numbered = ['014_18502 Boysenberry Dr 156 Gaithersburg MD5147.jpg', '004_18502 Boysenberry Dr 156 Gaithersburg MD5132.jpg'];
  it('removes only the separate number token and keeps the address and camera ID', () => {
    expect(previewBatchRenameFilenames(numbered, { mode: 'numbering', number_action: 'remove' })).toEqual([
      '18502 Boysenberry Dr 156 Gaithersburg MD5147.jpg',
      '18502 Boysenberry Dr 156 Gaithersburg MD5132.jpg',
    ]);
    expect(previewBatchRenameFilenames(['18502 Boysenberry Dr.jpg', 'SNAP5147.CR3', 'Kitchen.jpg'], { mode: 'numbering' })).toEqual(['18502 Boysenberry Dr.jpg', 'SNAP5147.CR3', 'Kitchen.jpg']);
  });
  it('moves existing numbers without changing their value or zero padding', () => {
    const moved = previewBatchRenameFilenames(numbered, { mode: 'numbering', number_action: 'move', number_position: 'end', separator: '_' });
    expect(moved[0]).toBe('18502 Boysenberry Dr 156 Gaithersburg MD5147_014.jpg');
    expect(previewBatchRenameFilenames(moved, { mode: 'numbering', number_action: 'move', number_position: 'start', separator: '_' })).toEqual(numbered);
  });
  it('replaces existing numbering with a sequence that can start at zero', () => {
    expect(previewBatchRenameFilenames(numbered, { mode: 'numbering', number_action: 'renumber', number_position: 'start', start: 0, digits: 3, value: 'Kitchen,', separator: '_' })).toEqual(['000_Kitchen.jpg', '001_Kitchen.jpg']);
  });
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
