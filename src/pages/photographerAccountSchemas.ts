import { z } from 'zod';

/**
 * Form schemas for the photographer's own account page.
 *
 * Extracted verbatim from `PhotographerAccount.tsx` to keep that page under the
 * repository file-size limit. Field names, validation messages and inferred
 * types are unchanged.
 */

export const personalInfoSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().min(10, { message: 'Please enter a valid phone number.' }),
  bio: z.string().optional(),
  portfolioWebsite: z.string().optional().or(z.literal('')),
  currentPassword: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zip: z.string().optional().or(z.literal('')),
  travelRange: z.number().min(1).max(500),
  travelRangeUnit: z.enum(['miles', 'km']),
  weeklyInvoice: z.boolean(),
  /**
   * Default exposures per HDR stack. Seeds a newly assigned bracket-capable service;
   * a service already recording its own size is never rewritten by changing this.
   */
  defaultBracketMode: z.union([z.literal(3), z.literal(5)]),
});

export const specialtiesSchema = z.object({
  specialties: z.array(z.string()).min(1, { message: 'Please select at least one specialty.' }),
});

export const notificationsSchema = z.object({
  email_notifications: z.boolean().default(true),
  sms_notifications: z.boolean().default(true),
});

export type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;
export type SpecialtiesFormValues = z.infer<typeof specialtiesSchema>;
export type NotificationsFormValues = z.infer<typeof notificationsSchema>;
