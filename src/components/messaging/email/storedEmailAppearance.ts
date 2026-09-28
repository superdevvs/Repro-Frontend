const surfaceSelector = 'div, p, span, td, th, table, section, aside, blockquote, center';
const actionSelector = '.atelier-button, .button, .cta-button, .btn-primary, .btn-secondary-bg';
const adaptiveSurfaceSelector = '.email-solid-surface, .body-bg, .content-card-bg, .hero-card-bg, .section-card-bg, .stat-card-bg, .note-card-bg, .callout-bg, .callout-success-bg, .callout-warning-bg, .callout-danger-bg, .info-box, .change-card';
const adaptiveTextSelector = '.dark-title, .dark-heading, .dark-strong, .dark-body, .dark-muted, .info-label, .info-value, .detail-label, .detail-value, .legal-copy-dark';

function solidBackground(element: HTMLElement): string {
  if (element.hasAttribute('background') || (element.style.backgroundImage && !/^(?:none|initial|unset|revert(?:-layer)?)$/.test(element.style.backgroundImage))) return '';
  const color = element.style.backgroundColor || element.getAttribute('bgcolor')?.trim() || '';
  return /^(?:none|transparent|inherit|initial|unset|revert|currentcolor)$/i.test(color)
    || /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(color) ? '' : color;
}

function isActionContainer(element: HTMLElement): boolean {
  if (element.matches(actionSelector) || element.closest('a')) return true;
  const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('a'));
  const compact = (value: string) => value.replace(/\s+/g, '');
  return links.length > 0
    && links.every((link) => link.matches(actionSelector) || solidBackground(link))
    && compact(element.textContent || '') === compact(links.map((link) => link.textContent).join(''));
}

/** Repair legacy stored RePro markup for display; never change the saved message. */
export function repairStoredEmailAppearance(document: Document): void {
  // External emails retain their own presentation. Only this known renderer
  // recolored the text without consistently pairing it with its surface.
  if (document.body.dataset.emailDesign !== 'atelier-v6') return;
  const content = document.querySelector<HTMLElement>('[data-email-content], .body-inner');
  if (!content) return;

  // Legacy rendering also assigned body/heading colors to nested CTA labels.
  for (const button of content.querySelectorAll('a.atelier-button, a.button, a.cta-button')) {
    for (const label of button.querySelectorAll<HTMLElement>('span, strong, b, em, i, small, font')) {
      label.style.setProperty('color', '#ffffff', 'important');
    }
  }

  let repaired = false;
  for (const element of content.querySelectorAll<HTMLElement>(surfaceSelector)) {
    if (element.hasAttribute('data-email-inbox-surface') || element.matches(adaptiveSurfaceSelector)) continue;
    // Native badges may intentionally use a fixed foreground/background pair.
    if (element.style.color && !element.matches(adaptiveTextSelector)) continue;
    const color = solidBackground(element);
    if (!color || isActionContainer(element)) continue;
    element.setAttribute('data-email-inbox-surface', '');
    // Keep the authored light background, allowing the paired dark rule to win
    // even when an old template made the solid background inline !important.
    for (const property of ['background', 'background-color']) {
      if (element.style.getPropertyPriority(property)) {
        element.style.setProperty(property, element.style.getPropertyValue(property));
      }
    }
    repaired = true;
  }
  if (!repaired || document.getElementById('email-inbox-appearance')) return;

  const style = document.createElement('style');
  style.id = 'email-inbox-appearance';
  const selector = 'body[data-email-design="atelier-v6"] [data-email-inbox-surface]';
  const darkRule = `${selector} { background-color: #1b2a3e !important; border-color: #2c425e !important; }`;
  const theme = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')?.trim();
  style.textContent = theme === 'dark' ? darkRule : theme === 'light' ? '' : `
    @media (prefers-color-scheme: dark) { ${darkRule} }
    [data-ogsc] ${selector}, body[data-ogsc][data-email-design="atelier-v6"] [data-email-inbox-surface] {
      background-color: #1b2a3e !important; border-color: #2c425e !important;
    }
  `;
  document.head.appendChild(style);
}
