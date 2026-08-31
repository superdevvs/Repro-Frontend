import { afterEach, describe, expect, it } from 'vitest';
import { installImageContextMenuGuard } from './imageContextMenuGuard';

const dispatchContextMenu = (target: Element) => {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('installImageContextMenuGuard', () => {
  it('prevents the native context menu on images mounted anywhere in the document', () => {
    const removeGuard = installImageContextMenuGuard();
    const image = document.createElement('img');
    document.body.append(image);

    expect(dispatchContextMenu(image).defaultPrevented).toBe(true);

    removeGuard();
  });

  it('also protects images mounted after the guard, including portal-style content', () => {
    const removeGuard = installImageContextMenuGuard();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);

    const image = document.createElement('img');
    dialog.append(image);

    expect(dispatchContextMenu(image).defaultPrevented).toBe(true);

    removeGuard();
  });

  it('does not interfere with context menus on non-image controls', () => {
    const removeGuard = installImageContextMenuGuard();
    const button = document.createElement('button');
    document.body.append(button);

    expect(dispatchContextMenu(button).defaultPrevented).toBe(false);

    removeGuard();
  });

  it('leaves image clicks and drag interactions unchanged', () => {
    const removeGuard = installImageContextMenuGuard();
    const image = document.createElement('img');
    document.body.append(image);
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const dragEvent = new Event('dragstart', { bubbles: true, cancelable: true });

    image.dispatchEvent(clickEvent);
    image.dispatchEvent(dragEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
    expect(dragEvent.defaultPrevented).toBe(false);

    removeGuard();
  });

  it('restores native image context menus when removed', () => {
    const removeGuard = installImageContextMenuGuard();
    const image = document.createElement('img');
    document.body.append(image);
    removeGuard();

    expect(dispatchContextMenu(image).defaultPrevented).toBe(false);
  });
});
