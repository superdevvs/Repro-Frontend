import { describe, expect, it } from 'vitest';
import { repairStoredEmailAppearance } from './storedEmailAppearance';

function email(content: string, theme = 'light dark') {
  return new DOMParser().parseFromString(`<!doctype html><html><head>
    <meta name="color-scheme" content="${theme}"></head>
    <body data-email-design="atelier-v6"><div data-email-content>${content}</div></body></html>`, 'text/html');
}

describe('stored RePro email appearance', () => {
  it('pairs legacy cancellation and note backgrounds with their adaptive text without editing the content', () => {
    const document = email(`<div id="policy" style="background:#fffbeb;padding:16px">
      <strong class="dark-strong">Cancellation Policy</strong>
      <span class="dark-body">A $60 cancellation fee may apply.</span></div>
      <div class="note dark-body" style="background-color:#f8fbff">Notes remain available.</div>`);
    const copy = document.body.textContent;
    repairStoredEmailAppearance(document);
    expect(document.querySelectorAll('[data-email-inbox-surface]')).toHaveLength(2);
    expect(document.querySelector<HTMLElement>('#policy')!.style.backgroundColor).toContain('rgb(255, 251, 235)');
    expect(document.querySelector<HTMLElement>('#policy')!.style.padding).toBe('16px');
    expect(document.body.textContent).toBe(copy);
    expect(document.head.textContent).toContain('prefers-color-scheme: dark');
    expect(document.head.textContent).toContain('[data-ogsc]');
  });

  it('handles legacy bgcolor and important shorthand without changing their light fallbacks', () => {
    const document = email('<table bgcolor="#fff3cd"><tr><td style="background:#f8f9fa !important">Invoice 123</td></tr></table>');
    repairStoredEmailAppearance(document);
    expect(document.querySelectorAll('[data-email-inbox-surface]')).toHaveLength(2);
    expect(document.querySelector<HTMLElement>('td')!.style.backgroundColor).toBe('rgb(248, 249, 250)');
    expect(document.querySelector<HTMLElement>('td')!.style.getPropertyPriority('background-color')).toBe('');
    expect(document.querySelector<HTMLElement>('td')!.style.getPropertyPriority('background')).toBe('');
    expect(document.querySelector('table')!.getAttribute('bgcolor')).toBe('#fff3cd');
  });

  it('recognizes solid backgrounds when the browser expands their image component to initial', () => {
    const document = email('<div style="background-color:#fffbeb;background-image:initial">Cancellation policy</div>');
    repairStoredEmailAppearance(document);
    expect(document.querySelectorAll('[data-email-inbox-surface]')).toHaveLength(1);
  });

  it('preserves buttons and their wrappers, transparent surfaces, images, and gradients', () => {
    const document = email(`<table><tr><td bgcolor="#155bdd"><a class="atelier-button" href="https://example.com/pay" style="background:#155bdd;color:#fff">Pay Now</a></td></tr></table>
      <span class="button" style="background:#155bdd">Action</span>
      <div style="background:transparent">Transparent</div>
      <div style="background:rgba(0,0,0,0)">Also transparent</div>
      <table bgcolor="#eee" background="https://example.com/background.jpg"><tr><td>Photo background</td></tr></table>
      <div style="background:#eee url(https://example.com/photo.jpg)"><img src="https://example.com/image.jpg"></div>
      <div style="background:linear-gradient(#fff,#000)">Gradient</div>`);
    const original = document.documentElement.outerHTML;
    repairStoredEmailAppearance(document);
    expect(document.documentElement.outerHTML).toBe(original);
  });

  it('leaves external messages and already corrected surfaces unchanged', () => {
    const external = email('<div style="background:#fffbeb">External content</div>');
    external.body.removeAttribute('data-email-design');
    const fixed = email('<div class="email-solid-surface" style="background:#fffbeb">Corrected by the server</div><div class="note-card-bg" style="background:#f7fbff">Already adaptive</div>');
    for (const document of [external, fixed]) {
      const original = document.documentElement.outerHTML;
      repairStoredEmailAppearance(document);
      expect(document.documentElement.outerHTML).toBe(original);
    }
  });

  it('keeps nested action labels white when legacy body and heading rules would recolor them', () => {
    const document = email('<a class="atelier-button" href="https://example.com/pay" style="background:#155bdd;color:#fff"><span class="dark-body" style="color:#465971 !important">Pay <strong class="dark-strong">invoice</strong></span></a>');
    repairStoredEmailAppearance(document);
    for (const label of document.querySelectorAll<HTMLElement>('span, strong')) {
      expect(label.style.color).toBe('rgb(255, 255, 255)');
      expect(label.style.getPropertyPriority('color')).toBe('important');
    }
    expect(document.querySelector('a')!.getAttribute('href')).toBe('https://example.com/pay');
    expect(document.querySelectorAll('[data-email-inbox-surface]')).toHaveLength(0);
  });

  it('preserves native badge foreground and background pairs', () => {
    const document = email('<span class="pill-bg" style="background-color:#edf4ff;color:#295391">Exclusive Listing</span>', 'dark');
    const original = document.documentElement.outerHTML;
    repairStoredEmailAppearance(document);
    expect(document.documentElement.outerHTML).toBe(original);
  });

  it.each(['light', 'dark'])('respects an explicitly rendered %s theme', (theme) => {
    const document = email('<div style="background:#fffbeb">Policy</div>', theme);
    repairStoredEmailAppearance(document);
    const css = document.getElementById('email-inbox-appearance')!.textContent;
    expect(css).not.toContain('@media');
    expect(css.includes('#1b2a3e')).toBe(theme === 'dark');
  });

  it('can run again after iframe load without duplicating rules or changing backgrounds', () => {
    const document = email('<div style="background:#fffbeb">Policy</div>');
    repairStoredEmailAppearance(document);
    const original = document.documentElement.outerHTML;
    repairStoredEmailAppearance(document);
    expect(document.documentElement.outerHTML).toBe(original);
  });
});
