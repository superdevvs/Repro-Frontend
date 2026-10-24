import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountFormSchema } from '@/components/accounts/accountFormModel';
import { registerSchema } from '@/components/auth/registerFormModel';
import { notificationsSchema } from '@/pages/photographerAccountSchemas';

describe('validation dependency compatibility', () => {
  it('retains account defaults and viewer-specific required fields', () => {
    const account = { firstName: 'Sample', lastName: 'Client', email: 'client@example.test', role: 'client' };
    expect(createAccountFormSchema('superadmin').parse(account).isActive).toBe(true);
    const result = createAccountFormSchema('admin').safeParse(account);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.path[0])).toContain('licenseNumber');
  });

  it('returns field errors through the form resolver for invalid registrations', async () => {
    const result = await zodResolver(registerSchema)({
      firstName: 'Sample', lastName: 'Client', email: 'invalid', password: 'short',
      confirmPassword: 'different', terms: false,
    }, undefined, { fields: {}, shouldUseNativeValidation: false });
    expect(result.errors.email?.message).toBe('Invalid email address');
    expect(result.errors.password?.message).toMatch(/8 characters/);
    expect(result.errors.confirmPassword?.message).toBe('Passwords do not match');
    expect(result.errors.terms?.message).toContain('Terms & Conditions');
  });

  it('keeps the notification default and an explicit opt-out', () => {
    expect(notificationsSchema.parse({}).email_notifications).toBe(true);
    expect(notificationsSchema.parse({ email_notifications: false }).email_notifications).toBe(false);
  });

  it('rejects an oversized constrained collection before walking its elements', () => {
    let visited = 0;
    const schema = z.array(z.string().superRefine(() => { visited += 1; })).max(2);
    const result = schema.safeParse(['a', 'b', 'c']);
    expect(result.success).toBe(false);
    expect(visited).toBe(0);
    if (!result.success) expect(result.error.issues).toHaveLength(1);
  });
});
