import { describe, expect, it } from 'vitest';
import { salesCategoryChoices } from './accountFormModel';

describe('sales category choices', () => {
  it('offers every scheduling category and keeps a saved category that is no longer listed', () => {
    expect(salesCategoryChoices(
      ['Photos', 'Photos & Floor plans', 'Drone'],
      ['Editing Upsell', 'Photos'],
    )).toEqual(['Photos', 'Photos & Floor plans', 'Drone', 'Editing Upsell']);
  });
});
