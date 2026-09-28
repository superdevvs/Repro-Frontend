import { describe, expect, it } from 'vitest';
import { getBookedEditorPhotoCount } from './editorRates';

describe('booked editor photo counts', () => {
  it('retains an explicit API line total without multiplying it again', () => {
    expect(getBookedEditorPhotoCount({ name: '10 HDR Photos', photo_count: 30, quantity: 3 })).toBe(30);
    expect(getBookedEditorPhotoCount({ name: '10 HDR Photos', photoCount: 30, pivot: { quantity: 3 } })).toBe(30);
  });

  it('scales a name-derived package size by the number booked, matching backend payouts', () => {
    expect(getBookedEditorPhotoCount({ name: '10 HDR Photos', photo_count: null, quantity: 3 })).toBe(30);
    expect(getBookedEditorPhotoCount({ name: '25 Photos', pivot: { quantity: 2 } })).toBe(50);
    expect(getBookedEditorPhotoCount({ name: '40 HDR', quantity: 2 })).toBe(80);
  });

  it('preserves single-package fallback and does not invent a missing count', () => {
    expect(getBookedEditorPhotoCount({ name: '10 Exterior HDR Photos' })).toBe(10);
    expect(getBookedEditorPhotoCount({ name: 'HDR Photos', quantity: 3 })).toBe(0);
    expect(getBookedEditorPhotoCount({ name: '10 Photos', quantity: 0 })).toBe(10);
  });
});
