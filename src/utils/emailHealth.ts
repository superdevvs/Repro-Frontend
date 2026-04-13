import type { EmailHealth, EmailHealthStatus } from '@/types/auth';

const DOMAIN_SUGGESTIONS: Record<string, string> = {
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gail.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'outlok.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  'hotnail.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'icloud.con': 'icloud.com',
  'icloud.co': 'icloud.com',
  'test.con': 'test.com',
};

const COMMON_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'yahoo.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'comcast.net',
  'att.net',
  'verizon.net',
]);

const COMMON_TLD_CORRECTIONS: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  cm: 'com',
  vom: 'com',
  ogr: 'org',
  ogn: 'org',
  nte: 'net',
};

export interface LocalEmailHealthHint {
  level: 'none' | 'info' | 'warning' | 'error';
  status?: EmailHealthStatus;
  message?: string;
  suggestedCorrection?: string;
  requiresConfirmation?: boolean;
}

const levenshteinDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = row - 1;
    previous[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const temp = previous[column];
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + substitutionCost,
      );
      diagonal = temp;
    }
  }

  return previous[right.length];
};

const detectClosestCommonDomain = (domain: string): string | null => {
  if (!domain || COMMON_DOMAINS.has(domain)) {
    return null;
  }

  const candidateParts = domain.split('.');
  if (candidateParts.length !== 2) {
    return null;
  }

  const [candidateRoot, candidateTld] = candidateParts;
  if (!candidateRoot || !candidateTld) {
    return null;
  }

  for (const commonDomain of COMMON_DOMAINS) {
    const [commonRoot, commonTld] = commonDomain.split('.');
    if (!commonRoot || !commonTld || candidateTld !== commonTld) {
      continue;
    }

    if (candidateRoot[0] !== commonRoot[0]) {
      continue;
    }

    if (Math.abs(candidateRoot.length - commonRoot.length) > 1) {
      continue;
    }

    if (levenshteinDistance(candidateRoot, commonRoot) <= 1) {
      return commonDomain;
    }
  }

  return null;
};

export function normalizeEmailHealth(value: any): EmailHealth | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return {
    status: (value.status ?? null) as EmailHealthStatus,
    verification_sent_at: value.verification_sent_at ?? null,
    email_verified_at: value.email_verified_at ?? null,
    last_delivery_attempt_at: value.last_delivery_attempt_at ?? null,
    last_bounce_at: value.last_bounce_at ?? null,
    bounce_reason: value.bounce_reason ?? null,
    warning_code: value.warning_code ?? null,
    warning_message: value.warning_message ?? null,
    suggested_correction: value.suggested_correction ?? null,
    requires_confirmation: Boolean(value.requires_confirmation),
  };
}

export function analyzeEmailInput(email: string): LocalEmailHealthHint {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { level: 'none' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return {
      level: 'error',
      status: 'invalid',
      message: 'Please enter a valid email address.',
    };
  }

  const [local, domain] = trimmed.split('@');
  if (!local || !domain) {
    return {
      level: 'error',
      status: 'invalid',
      message: 'Please enter a valid email address.',
    };
  }

  if (DOMAIN_SUGGESTIONS[domain]) {
    const suggestedCorrection = `${local}@${DOMAIN_SUGGESTIONS[domain]}`;
    return {
      level: 'warning',
      status: 'risky',
      message: `${domain} looks like a typo. Use ${DOMAIN_SUGGESTIONS[domain]} instead?`,
      suggestedCorrection,
      requiresConfirmation: true,
    };
  }

  const closestCommonDomain = detectClosestCommonDomain(domain);
  if (closestCommonDomain) {
    const suggestedCorrection = `${local}@${closestCommonDomain}`;
    return {
      level: 'warning',
      status: 'risky',
      message: `${domain} looks like a typo. Use ${closestCommonDomain} instead?`,
      suggestedCorrection,
      requiresConfirmation: true,
    };
  }

  const domainParts = domain.split('.');
  if (domainParts.length > 1) {
    const tld = domainParts[domainParts.length - 1];
    if (COMMON_TLD_CORRECTIONS[tld]) {
      const suggestedCorrection = `${local}@${domainParts.slice(0, -1).join('.')}.${COMMON_TLD_CORRECTIONS[tld]}`;
      return {
        level: 'warning',
        status: 'risky',
        message: `${domain} looks like a typo. Use ${domainParts.slice(0, -1).join('.')}.${COMMON_TLD_CORRECTIONS[tld]} instead?`,
        suggestedCorrection,
        requiresConfirmation: true,
      };
    }
  }

  if (!COMMON_DOMAINS.has(domain)) {
    return {
      level: 'info',
      status: 'risky',
      message: 'This domain looks unusual. Please confirm before saving.',
    };
  }

  return {
    level: 'info',
    status: 'unverified',
    message: 'This email will be saved as unverified until the client confirms it.',
  };
}

export function getEmailHealthLabel(status?: EmailHealthStatus): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'unverified':
      return 'Unverified';
    case 'risky':
      return 'Delivery Risk';
    case 'bounced':
      return 'Bounced';
    case 'invalid':
      return 'Invalid';
    default:
      return 'Unknown';
  }
}

export function getEmailHealthClasses(status?: EmailHealthStatus): string {
  switch (status) {
    case 'verified':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'unverified':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'risky':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'bounced':
    case 'invalid':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}
