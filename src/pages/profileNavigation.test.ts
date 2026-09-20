import { describe, expect, it } from 'vitest';
import { selfAccountDestination } from './profileNavigation';

describe('self account destination', () => {
  it('sends photographers and editors to Settings instead of a separate Profile page', () => {
    expect(selfAccountDestination('photographer', '?tab=notifications')).toBe('/settings?tab=notifications');
    expect(selfAccountDestination('editor')).toBe('/settings');
  });

  it('leaves other roles on the dedicated profile page', () => {
    expect(selfAccountDestination('client')).toBeNull();
    expect(selfAccountDestination('admin')).toBeNull();
  });
});
