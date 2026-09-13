import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observePageImages } from './observe-page-images';

const rect = (left = 20, top = 20, width = 100, height = 100): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });

describe('initial page images', () => {
  let root: HTMLDivElement;
  let cleanup: (() => void) | undefined;

  const addImage = (bounds = rect(), src = '/photo.jpg') => {
    const image = document.createElement('img');
    if (src) image.src = src;
    Object.defineProperty(image, 'complete', { configurable: true, value: false });
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(bounds);
    root.append(image);
    return image;
  };

  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 800, 600));
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    root.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('waits for all visible images and releases both loaded and failed images', () => {
    const first = addImage();
    const second = addImage();
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    expect(changed.mock.calls).toEqual([[true]]);
    first.dispatchEvent(new Event('load'));
    expect(changed.mock.calls).toEqual([[true]]);
    second.dispatchEvent(new Event('error'));
    expect(changed.mock.calls).toEqual([[true], [false]]);
    second.dispatchEvent(new Event('error'));
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('ignores complete, sourceless, hidden, and offscreen images including lazy images', () => {
    Object.defineProperty(addImage(), 'complete', { value: true });
    addImage(rect(), '');
    addImage().hidden = true;
    const hiddenParent = document.createElement('div');
    hiddenParent.style.display = 'none';
    root.append(hiddenParent);
    hiddenParent.append(addImage());
    addImage(rect(20, 900)).loading = 'lazy';
    addImage(rect(810, 20)); // Inside browser, outside the page content viewport.
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    expect(changed.mock.calls).toEqual([[false]]);
  });

  it('notices new images, removal, and source changes after a settled image', async () => {
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    const image = addImage();
    await Promise.resolve();
    expect(changed).toHaveBeenLastCalledWith(true);
    image.dispatchEvent(new Event('load'));
    expect(changed).toHaveBeenLastCalledWith(false);
    image.src = '/replacement.jpg';
    await Promise.resolve();
    expect(changed).toHaveBeenLastCalledWith(true);
    image.remove();
    await Promise.resolve();
    expect(changed.mock.calls).toEqual([[false], [true], [false], [true], [false]]);
  });

  it('checks the browser viewport and keeps images under the loading overlay eligible', () => {
    vi.mocked(root.getBoundingClientRect).mockReturnValue(rect(0, 0, 1200, 1400));
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('inert', '');
    addImage(rect(20, 900));
    const visibleImage = addImage();
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    expect(changed).toHaveBeenLastCalledWith(true);
    visibleImage.dispatchEvent(new Event('load'));
    expect(changed.mock.calls).toEqual([[true], [false]]);
  });

  it('tracks responsive picture sources and visibility changes', async () => {
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.srcset = '/responsive.jpg';
    picture.append(source);
    root.append(picture);
    const image = addImage(rect(), '');
    picture.append(image);
    picture.hidden = true;
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    picture.hidden = false;
    await Promise.resolve();
    expect(changed).toHaveBeenLastCalledWith(true);
    image.dispatchEvent(new Event('error'));
    source.srcset = '/responsive-new.jpg';
    await Promise.resolve();
    expect(changed.mock.calls).toEqual([[false], [true], [false], [true]]);
  });

  it('rechecks the viewport during scroll and resize', () => {
    const image = addImage(rect(20, 900));
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    vi.mocked(image.getBoundingClientRect).mockReturnValue(rect());
    root.dispatchEvent(new Event('scroll'));
    expect(changed).toHaveBeenLastCalledWith(true);
    vi.mocked(image.getBoundingClientRect).mockReturnValue(rect(20, 900));
    window.dispatchEvent(new Event('resize'));
    expect(changed.mock.calls).toEqual([[false], [true], [false]]);
  });

  it.each(['auto', 'scroll', 'hidden', 'clip'])('ignores lazy images clipped by a nested overflow %s panel', (overflow) => {
    const panel = document.createElement('div');
    panel.style.overflowY = overflow;
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(100, 100, 200, 100));
    root.append(panel);
    const image = addImage(rect(120, 250));
    image.loading = 'lazy';
    panel.append(image);
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    expect(changed.mock.calls).toEqual([[false]]);
    vi.mocked(image.getBoundingClientRect).mockReturnValue(rect(120, 190));
    panel.dispatchEvent(new Event('scroll'));
    expect(changed.mock.calls).toEqual([[false], [true]]);
    image.dispatchEvent(new Event('load'));
    expect(changed).toHaveBeenLastCalledWith(false);
  });

  it('applies horizontal clipping while preserving visible overflow on the other axis', () => {
    const panel = document.createElement('div');
    panel.style.overflowX = 'clip';
    panel.style.overflowY = 'visible';
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(rect(100, 100, 200, 100));
    root.append(panel);
    const image = addImage(rect(320, 250));
    panel.append(image);
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    expect(changed).toHaveBeenLastCalledWith(false);
    vi.mocked(image.getBoundingClientRect).mockReturnValue(rect(250, 250));
    panel.dispatchEvent(new Event('scroll'));
    expect(changed.mock.calls).toEqual([[false], [true]]);
  });

  it('disconnects observers and event listeners when the page is ready or unmounts', async () => {
    const image = addImage();
    const changed = vi.fn();
    cleanup = observePageImages(root, changed);
    cleanup();
    image.dispatchEvent(new Event('load'));
    image.dispatchEvent(new Event('error'));
    image.remove();
    window.dispatchEvent(new Event('resize'));
    root.dispatchEvent(new Event('scroll'));
    await Promise.resolve();
    expect(changed.mock.calls).toEqual([[true]]);
  });
});
