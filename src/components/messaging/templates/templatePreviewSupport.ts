export function prepareTemplatePreviewHtml(html: string): string {
  const preview = document.createElement('template');
  preview.innerHTML = html;

  // Embedded styles can escape the preview and also reintroduce unreadable
  // dark-template colors. The delivered email gets its layout styles from the
  // renderer, so the editor preview uses the same fixed, light-safe palette.
  preview.content.querySelectorAll('style, link[rel="stylesheet"]').forEach((element) => element.remove());

  preview.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    const isAnchor = element.tagName === 'A';
    const hasInlineBackground = Boolean(
      element.style.background || element.style.backgroundColor || element.style.backgroundImage
    );
    const isCta = element.tagName === 'BUTTON' || (
      isAnchor && (
        element.classList.contains('button') ||
        element.classList.contains('button-large') ||
        element.getAttribute('role') === 'button' ||
        hasInlineBackground
      )
    );

    if (isCta) {
      element.setAttribute('data-email-preview-cta', '');
    } else {
      element.style.removeProperty('background');
      element.style.removeProperty('background-color');
      element.style.removeProperty('background-image');
    }

    element.style.removeProperty('color');
  });

  return preview.innerHTML;
}

type PreviewTitleParts = {
  overline?: string;
  primary: string;
  accent?: string;
};

function isDynamicContextSegment(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.includes('{{') || trimmed.includes('[')) {
    return true;
  }

  if (/\d/.test(trimmed) || trimmed.includes(',')) {
    return true;
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  return wordCount >= 4 && trimmed.length >= 20;
}

export function getPreviewTitleParts(title: string): PreviewTitleParts {
  const trimmed = title.trim();
  if (!trimmed) {
    return { primary: 'R/E Pro Photos update.' };
  }

  const suffixMatch = trimmed.match(/^(.*)\s+(New Account Information|Payment Due Reminder|Shoot Delivered|Summary)$/);
  if (suffixMatch) {
    return {
      overline: suffixMatch[1].trim(),
      primary: suffixMatch[2],
    };
  }

  const placeholderLead = trimmed.match(/^(\{\{[^}]+\}\}|\[[^\]]+\])\s+(.+)$/);
  if (placeholderLead) {
    return {
      overline: placeholderLead[1].trim(),
      primary: placeholderLead[2].trim(),
    };
  }

  const split = trimmed.split(/\s+-\s+|\s+\|\s+|\s*:\s*/, 2);
  if (split.length === 2) {
    const [first, second] = split.map((part) => part.trim());

    if (isDynamicContextSegment(first) !== isDynamicContextSegment(second)) {
      const overline = isDynamicContextSegment(first) ? first : second;
      const primary = overline === first ? second : first;

      return {
        overline,
        primary: primary.replace(/\.$/, ''),
      };
    }

    return {
      primary: `${first.replace(/\.$/, '')}.`,
      accent: second,
    };
  }

  const sentenceSplit = trimmed.split(/(?<=[.!?])\s+/, 2);
  if (sentenceSplit.length === 2) {
    return {
      primary: sentenceSplit[0],
      accent: sentenceSplit[1],
    };
  }

  return { primary: trimmed };
}

export function getPreviewCopy(category: string, description: string): string {
  if (description.trim()) {
    return description.trim();
  }

  switch (category) {
    case 'ACCOUNT':
      return 'Everything you need is organized below, including the latest account details and access links.';
    case 'BOOKING':
      return 'Your latest schedule details, property notes, and next actions are organized below in one place.';
    case 'REMINDER':
      return 'A timely reminder with the key details you need before the next step in the workflow.';
    case 'PAYMENT':
      return 'Your transaction status and the next milestones in the workflow are summarized below.';
    case 'INVOICE':
      return 'Invoice details, due dates, and follow-up actions are collected below for quick review.';
    default:
      return 'The latest update from your R/E Pro Photos workflow is ready below.';
  }
}
