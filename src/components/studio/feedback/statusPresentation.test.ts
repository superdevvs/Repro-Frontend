import { describe, expect, it } from 'vitest';

import { KNOWN_STATUS_KEYS, resolveStatusPresentation } from './statusPresentation';

/**
 * `STATUS_DEFINITIONS` is a plain object literal, so a bare index lookup
 * resolves inherited `Object.prototype` members. `STATUS_DEFINITIONS.constructor`
 * is the truthy `Object` function, which survived the `??` fallback and produced
 * `icon: undefined` — a broken badge and a React crash, despite the type
 * claiming `icon: LucideIcon`. Regression cover for Req 12.11.
 */
const PROTOTYPE_KEYS = [
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__proto__',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
];

describe('resolveStatusPresentation', () => {
  it.each(PROTOTYPE_KEYS)('treats %s as an unknown status rather than a prototype member', (key) => {
    const presentation = resolveStatusPresentation(key);

    expect(presentation.icon).toBeTypeOf('object');
    expect(presentation.icon).not.toBeUndefined();
    expect(presentation.label).not.toBe('');
    expect(presentation.accessibleLabel).toContain(presentation.label);
    expect(presentation.tone).toBe('neutral');
    expect(presentation.isBusy).toBe(false);
  });

  it('still resolves every known status to its own definition', () => {
    for (const key of KNOWN_STATUS_KEYS) {
      const presentation = resolveStatusPresentation(key);

      expect(presentation.icon).toBeTypeOf('object');
      expect(presentation.label).not.toBe('');
      expect(presentation.status).toBe(key);
    }
  });

  it('falls back to a usable presentation for empty and nullish statuses', () => {
    for (const value of ['', '   ', null, undefined]) {
      const presentation = resolveStatusPresentation(value);

      expect(presentation.icon).toBeTypeOf('object');
      expect(presentation.label).not.toBe('');
      expect(presentation.status).toBe('unknown');
    }
  });
});
