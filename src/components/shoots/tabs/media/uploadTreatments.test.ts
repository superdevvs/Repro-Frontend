import { describe, expect, it } from 'vitest';

import {
  RAW_STAGING_CLASSIFICATION_OPTIONS,
  UPLOAD_CLASSIFICATION_OPTIONS,
  UPLOAD_TREATMENTS,
  isUploadTreatment,
  resolveClassificationUploadFields,
} from './uploadClassificationOptions';

/**
 * Raw staging offers four per-file shortcuts, and the three treatments among them
 * must never be written where a capture identity lives.
 */
describe('raw staging shortcuts', () => {
  it('offers exactly VS, GG, TW and EX, in that order', () => {
    expect(RAW_STAGING_CLASSIFICATION_OPTIONS.map((option) => option.type)).toEqual([
      'virtual_staging',
      'green_grass',
      'twilight',
      'extra',
    ]);
    expect(RAW_STAGING_CLASSIFICATION_OPTIONS.map((option) => option.label)).toEqual([
      'VS',
      'GG',
      'TW',
      'EX',
    ]);
  });

  it('omits the floor plan shortcut, which is owned by the booked service group', () => {
    expect(RAW_STAGING_CLASSIFICATION_OPTIONS.some((option) => option.type === 'floorplan')).toBe(false);
    expect(RAW_STAGING_CLASSIFICATION_OPTIONS.some((option) => option.label === 'FP')).toBe(false);
  });

  it('omits the drone shortcut, which is a capture service rather than a per-file flag', () => {
    expect(RAW_STAGING_CLASSIFICATION_OPTIONS.some((option) => option.type === 'drone')).toBe(false);
    expect(RAW_STAGING_CLASSIFICATION_OPTIONS.some((option) => option.label === 'DR')).toBe(false);
  });

  it('leaves the full vocabulary intact for the post-upload reclassify menu', () => {
    // Narrowing raw staging must not remove FP/DR from the "Mark" action that
    // operates on already-uploaded media.
    expect(UPLOAD_CLASSIFICATION_OPTIONS.map((option) => option.type)).toContain('floorplan');
    expect(UPLOAD_CLASSIFICATION_OPTIONS.map((option) => option.type)).toContain('drone');
  });

  it('keeps treatments photo-only so a video frame cannot request one', () => {
    UPLOAD_TREATMENTS.forEach((treatment) => {
      const option = UPLOAD_CLASSIFICATION_OPTIONS.find((candidate) => candidate.type === treatment);
      expect(option?.photoOnly).toBe(true);
    });
  });
});

describe('isUploadTreatment', () => {
  it('recognises the three treatments', () => {
    expect(isUploadTreatment('virtual_staging')).toBe(true);
    expect(isUploadTreatment('green_grass')).toBe(true);
    expect(isUploadTreatment('twilight')).toBe(true);
  });

  it('does not treat a media type as a treatment', () => {
    expect(isUploadTreatment('extra')).toBe(false);
    expect(isUploadTreatment('floorplan')).toBe(false);
    expect(isUploadTreatment('drone')).toBe(false);
  });
});

describe('resolveClassificationUploadFields', () => {
  it('sends a treatment in its own field and never as a media type', () => {
    expect(resolveClassificationUploadFields('virtual_staging')).toEqual({ treatment: 'virtual_staging' });
    expect(resolveClassificationUploadFields('green_grass')).toEqual({ treatment: 'green_grass' });
    expect(resolveClassificationUploadFields('twilight')).toEqual({ treatment: 'twilight' });
  });

  it('never emits media_type for a treatment', () => {
    // The regression this guards: writing a treatment into media_type overwrote
    // 'raw', which dropped the frame out of bracket stacking, the Photos tab and
    // the delivery whitelist.
    UPLOAD_TREATMENTS.forEach((treatment) => {
      const fields = resolveClassificationUploadFields(treatment);
      expect(fields).not.toHaveProperty('media_type');
      expect(fields).not.toHaveProperty('is_extra');
    });
  });

  it('keeps Extra as a media type with its exception flag', () => {
    expect(resolveClassificationUploadFields('extra')).toEqual({
      media_type: 'extra',
      is_extra: '1',
    });
  });

  it('sends nothing when no shortcut was chosen', () => {
    expect(resolveClassificationUploadFields(undefined)).toEqual({});
  });

  it('still routes a non-treatment media type to media_type without the extra flag', () => {
    expect(resolveClassificationUploadFields('floorplan')).toEqual({ media_type: 'floorplan' });
    expect(resolveClassificationUploadFields('drone')).toEqual({ media_type: 'drone' });
  });
});
