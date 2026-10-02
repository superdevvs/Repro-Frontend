import axios from 'axios';
import type { EmailHealth, UserRole } from '@/types/auth';
import { normalizeEmailHealth } from '@/utils/emailHealth';
import type { RegisterSuccessPayload } from './registerFormModel';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const safeMessage = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) return undefined;
  // Error pages and control characters are not useful form feedback.
  // eslint-disable-next-line no-control-regex
  return /<[^>]*>|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? undefined : value.trim();
};

/** A proxy's HTML error page can arrive with HTTP 200; it must never sign a user in. */
export function registrationSuccess(value: unknown): RegisterSuccessPayload | null {
  const data = asRecord(value);
  const user = asRecord(data?.user);
  const token = asString(data?.token);
  if (!user || !token?.trim() || !asString(user.name) || !asString(user.email)
    || !((typeof user.id === 'number' && Number.isFinite(user.id))
      || (typeof user.id === 'string' && user.id.trim()))) return null;

  return {
    token,
    user: {
      id: String(user.id),
      name: user.name as string,
      email: user.email as string,
      role: (user.role === 'sales_rep' ? 'salesRep' : asString(user.role) || 'client') as UserRole,
      company: asString(user.company_name),
      phone: asString(user.phonenumber),
      avatar: asString(user.avatar),
      bio: asString(user.bio),
      isActive: user.account_status === 'active',
      metadata: {
        city: asString(user.city), state: asString(user.state),
        zip: asString(user.zip), country: asString(user.country),
      },
      email_health: normalizeEmailHealth(user.email_health),
    },
  };
}

export interface RegistrationFailure {
  message: string;
  accountExists: boolean;
  emailMessage?: string;
  emailHealth?: EmailHealth;
}

export function registrationFailure(error: unknown): RegistrationFailure {
  const response = axios.isAxiosError(error) ? error.response : undefined;
  const data = asRecord(response?.data);
  const errors = asRecord(data?.errors);
  const emailErrors = errors?.email;
  const emailMessage = safeMessage(Array.isArray(emailErrors) ? emailErrors[0] : emailErrors);
  const fieldMessage = Object.values(errors ?? {}).flatMap((value) => Array.isArray(value) ? value : [value])
    .map(safeMessage).find(Boolean);
  const accountExists = data?.code === 'account_exists'
    || Boolean(emailMessage && /email.*already (?:been taken|taken|exists|registered)/i.test(emailMessage));
  const fallback = response?.status === 429
    ? 'Too many registration attempts. Please wait a moment and try again.'
    : "We couldn't complete registration. Please try again. If you already have an account, log in or reset your password.";
  const message = accountExists
    ? (data?.code === 'account_exists' ? safeMessage(data.message) : undefined)
      || (data?.email_verification_required === false
        ? 'An account with this email already exists. Please log in.'
        : 'An account with this email already exists. Please verify your email, then log in.')
    : emailMessage || fieldMessage || safeMessage(data?.message) || fallback;

  return {
    message, accountExists,
    emailMessage: accountExists ? message : emailMessage,
    emailHealth: normalizeEmailHealth(data?.email_health),
  };
}
