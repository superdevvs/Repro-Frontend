import { describe, expect, it } from 'vitest';
import { filterMediaSearch } from './mediaSearch';

describe('authorized shoot media filename search', () => {
  const files = [
    { id: '1', filename: 'Kitchen Final.jpg', fileType: 'image', url: 'https://private.test/secret', comments: [{ comment: 'private comment' }] },
    { id: '2', filename: 'Exterior.jpg', fileType: 'image' },
  ];
  it('filters the visible list without changing the source used for permissions and bulk actions', () => {
    expect(filterMediaSearch(files, 'KITCHEN')).toEqual([files[0]]);
    expect(files).toHaveLength(2);
    expect(filterMediaSearch(files, '')).toBe(files);
  });
  it('does not expose stored URLs or comment text through filename matching', () => {
    expect(filterMediaSearch(files, 'secret')).toEqual([]);
    expect(filterMediaSearch(files, 'private comment')).toEqual([]);
  });
});
