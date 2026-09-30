import { describe, expect, it } from 'vitest';
import type { MediaFile } from '@/hooks/useShootFiles';
import { buildPostRenameBatchPlan, diffBasenameForBatchReplace } from './postRenameBatchPlan';

const file = (id: string, filename: string) => ({ id, filename }) as MediaFile;

describe('diffBasenameForBatchReplace', () => {
  it('strips a shared numeric suffix', () => {
    expect(diffBasenameForBatchReplace('DSC_001', 'Kitchen_001')).toEqual({
      find: 'DSC',
      replace: 'Kitchen',
    });
  });

  it('strips a shared prefix and suffix', () => {
    expect(diffBasenameForBatchReplace('IMG_room', 'Final_room')).toEqual({
      find: 'IMG',
      replace: 'Final',
    });
  });

  it('falls back to full-base replace when nothing is shared', () => {
    expect(diffBasenameForBatchReplace('ShootA', 'ClientB')).toEqual({
      find: 'ShootA',
      replace: 'ClientB',
    });
  });

  it('returns null when unchanged', () => {
    expect(diffBasenameForBatchReplace('A', 'A')).toBeNull();
  });
});

describe('buildPostRenameBatchPlan', () => {
  it('returns null when basename did not change', () => {
    expect(
      buildPostRenameBatchPlan(
        { fileId: '1', previousFilename: 'A.jpg', nextFilename: 'A.jpg' },
        [file('1', 'A.jpg'), file('2', 'A-2.jpg')],
        [file('1', 'A.jpg'), file('2', 'A-2.jpg')],
      ),
    ).toBeNull();
  });

  it('applies DSC→Kitchen across siblings and skips the renamed file', () => {
    const plan = buildPostRenameBatchPlan(
      { fileId: '1', previousFilename: 'DSC_001.jpg', nextFilename: 'Kitchen_001.jpg' },
      [file('1', 'Kitchen_001.jpg'), file('2', 'DSC_002.jpg'), file('3', 'other.jpg')],
      [file('1', 'Kitchen_001.jpg'), file('2', 'DSC_002.jpg'), file('3', 'other.jpg'), file('4', 'DSC_004.jpg')],
    );
    expect(plan).toEqual({
      find: 'DSC',
      replace: 'Kitchen',
      selectedFileIds: ['2', '3'],
      allFileIds: ['2', '3', '4'],
      matchingSelectedFileIds: ['2'],
      matchingAllFileIds: ['2', '4'],
    });
  });

  it('collects selected and all candidates for a full-base replace', () => {
    const plan = buildPostRenameBatchPlan(
      { fileId: '1', previousFilename: 'ShootA.jpg', nextFilename: 'ClientB.jpg' },
      [file('1', 'ClientB.jpg'), file('2', 'ShootA-02.jpg')],
      [file('1', 'ClientB.jpg'), file('2', 'ShootA-02.jpg'), file('3', 'ShootA-03.jpg')],
    );
    expect(plan).toEqual({
      find: 'ShootA',
      replace: 'ClientB',
      selectedFileIds: ['2'],
      allFileIds: ['2', '3'],
      matchingSelectedFileIds: ['2'],
      matchingAllFileIds: ['2', '3'],
    });
  });

  it('still prompts when no other files contain the find token', () => {
    const plan = buildPostRenameBatchPlan(
      { fileId: '1', previousFilename: 'unique.jpg', nextFilename: 'solo.jpg' },
      [file('1', 'solo.jpg')],
      [file('1', 'solo.jpg'), file('2', 'other.jpg')],
    );
    expect(plan).toEqual({
      find: 'unique',
      replace: 'solo',
      selectedFileIds: [],
      allFileIds: ['2'],
      matchingSelectedFileIds: [],
      matchingAllFileIds: [],
    });
  });

  it('returns null when the renamed file is alone in view and selection', () => {
    expect(
      buildPostRenameBatchPlan(
        { fileId: '1', previousFilename: 'a.jpg', nextFilename: 'b.jpg' },
        [file('1', 'b.jpg')],
        [file('1', 'b.jpg')],
      ),
    ).toBeNull();
  });
});
