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

const EMAIL_HEALTH_STATUSES = new Set<Exclude<EmailHealthStatus, null>>([
  'verified',
  'unverified',
  'risky',
  'bounced',
  'invalid',
]);

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

const asNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asEmailHealthStatus = (value: unknown): EmailHealthStatus =>
  typeof value === 'string' && EMAIL_HEALTH_STATUSES.has(value as Exclude<EmailHealthStatus, null>)
    ? (value as Exclude<EmailHealthStatus, null>)
    : null;

export function normalizeEmailHealth(value: unknown): EmailHealth | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const emailHealth = value as Record<string, unknown>;
  const warningCode = asNullableString(emailHealth.warning_code);

  if (warningCode === 'unusual_domain') {
    return {
      status: 'unverified',
      verification_sent_at: asNullableString(emailHealth.verification_sent_at),
      email_verified_at: asNullableString(emailHealth.email_verified_at),
      last_delivery_attempt_at: asNullableString(emailHealth.last_delivery_attempt_at),
      last_bounce_at: asNullableString(emailHealth.last_bounce_at),
      bounce_reason: asNullableString(emailHealth.bounce_reason),
      warning_code: null,
      warning_message: null,
      suggested_correction: null,
      requires_confirmation: false,
    };
  }

  return {
    status: asEmailHealthStatus(emailHealth.status),
    verification_sent_at: asNullableString(emailHealth.verification_sent_at),
    email_verified_at: asNullableString(emailHealth.email_verified_at),
    last_delivery_attempt_at: asNullableString(emailHealth.last_delivery_attempt_at),
    last_bounce_at: asNullableString(emailHealth.last_bounce_at),
    bounce_reason: asNullableString(emailHealth.bounce_reason),
    warning_code: warningCode,
    warning_message: asNullableString(emailHealth.warning_message),
    suggested_correction: asNullableString(emailHealth.suggested_correction),
    requires_confirmation: Boolean(emailHealth.requires_confirmation),
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

  return {
    level: 'none',
  };
}

export function getEmailHealthLabel(status?: EmailHealthStatus): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'unverified':
    case 'risky':
      return 'Unverified';
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
      return 'border-emerald-400/45 bg-emerald-500/5 text-emerald-300';
    case 'unverified':
    case 'risky':
      return 'border-red-300 bg-red-50 text-red-700 dark:border-amber-400/55 dark:bg-amber-500/10 dark:text-amber-300';
    case 'bounced':
    case 'invalid':
      return 'border-rose-400/50 bg-rose-500/5 text-rose-300';
    default:
      return 'border-slate-400/35 bg-slate-500/5 text-slate-300';
  }
}
