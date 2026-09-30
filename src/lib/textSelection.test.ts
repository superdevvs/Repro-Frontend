import { describe, expect, it } from 'vitest';
import { hasActiveTextSelection } from './textSelection';

describe('hasActiveTextSelection', () => {
  it('is false when nothing is selected', () => {
    window.getSelection()?.removeAllRanges();
    expect(hasActiveTextSelection()).toBe(false);
  });

  it('is true only when the selection sits inside the boundary', () => {
    const root = document.createElement('div');
    const address = document.createElement('span');
    address.textContent = '1732 Fletchers';
    root.appendChild(address);
    document.body.appendChild(root);

    const range = document.createRange();
    range.selectNodeContents(address);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(hasActiveTextSelection(root)).toBe(true);
    expect(hasActiveTextSelection(document.createElement('div'))).toBe(false);

    selection?.removeAllRanges();
    root.remove();
  });
});
