import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('shoot overview section ordering', () => {
  it('keeps client-visible notes before payment details', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/shoots/tabs/ShootDetailsOverviewTab.tsx'),
      'utf8',
    );
    const notesSection = source.indexOf('{/* Client-visible notes precede payment details;');
    const paymentSection = source.indexOf('{/* Payment Summary Card');

    expect(notesSection).toBeGreaterThan(-1);
    expect(paymentSection).toBeGreaterThan(notesSection);
  });
});
