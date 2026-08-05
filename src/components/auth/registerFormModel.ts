import { z } from 'zod';

import type { UserData } from '@/types/auth';

export const TERMS_EFFECTIVE_DATE = 'April 16, 2026';

export const termsSections = [
  {
    title: 'R/E Pro Photos – Client Terms & Conditions (With SMS Consent)',
    effectiveDate: TERMS_EFFECTIVE_DATE,
    intro:
      'By booking, scheduling, or using the R/E Pro Photos platform (“Platform”), you agree to the following Terms & Conditions.',
    sections: [
      {
        heading: '1. Definitions',
        bullets: [
          '“Company” refers to R/E Pro Photos, LLC',
          '“Client” or “You” refers to the individual, agent, brokerage, or entity booking services',
          '“Property” refers to the real estate listed in your booking',
          '“Work” refers to all media produced, including photos, videos, 3D tours, floor plans, and derivative content',
          'You confirm you are authorized to book services and bind the property owner where applicable.',
        ],
      },
      {
        heading: '2. Payment Terms',
        bullets: [
          'Payment is due at the time of booking, unless otherwise agreed.',
          'Services and deliverables may be withheld until full payment is received.',
          'Usage rights are granted only after full payment.',
          'Unpaid shoots may display watermarked media.',
        ],
      },
      {
        heading: '3. Scheduling, Changes & Cancellations',
        bullets: [
          'Changes or cancellations made 24 or more hours prior incur no fee.',
          'Less than 24 hours may result in a cancellation or rescheduling fee.',
          'Property must be camera-ready at the scheduled time.',
          'R/E Pro Photos may reschedule if the property is not ready or accessible.',
          'R/E Pro Photos may cancel and charge a service fee if conditions prevent completion.',
        ],
      },
      {
        heading: '4. Ownership & Copyright',
        bullets: [
          'All Work remains the exclusive intellectual property of R/E Pro Photos.',
          'The Company retains full copyright ownership.',
          'The Company retains rights to reproduce, distribute, and license content.',
          'The Company retains rights to use Work for marketing, portfolio, and promotional purposes.',
          'No ownership rights transfer to the Client.',
        ],
      },
      {
        heading: '5. Usage License (Client)',
        paragraphs: ['Upon full payment, you receive a non-exclusive, non-transferable, limited license to use the Work for marketing the Property, promoting your real estate business, and MLS and listing platforms.'],
        bullets: [
          'No resale, sublicensing, or redistribution.',
          'No AI training or derivative commercial usage.',
          'License ends when the listing is no longer active.',
        ],
      },
      {
        heading: '6. SMS Consent & Communications (Telnyx-Compliant)',
        paragraphs: ['By providing your phone number through the Platform, including booking forms, account registration, or direct input, you expressly consent to receive SMS or text messages from R/E Pro Photos.'],
        subSections: [
          {
            title: 'Types of Messages You May Receive',
            bullets: [
              'Booking confirmations',
              'Appointment reminders',
              'Shoot status updates',
              'Delivery notifications',
              'Payment alerts',
              'Account and security notifications',
              'Customer support responses',
            ],
          },
          {
            title: 'Message Frequency',
            paragraphs: ['Varies depending on your activity, typically 1 to 10 messages per booking lifecycle.'],
          },
          {
            title: 'Message & Data Rates',
            paragraphs: ['Standard carrier message and data rates may apply.'],
          },
          {
            title: 'Opt-Out Instructions',
            bullets: ['Reply STOP to unsubscribe from SMS.', 'Reply HELP to receive assistance.'],
          },
          {
            title: 'Important Disclosures',
            bullets: [
              'SMS consent is not a condition of purchase.',
              'Your phone number will not be sold or shared with third parties for marketing.',
              'Messages are strictly service-related unless separately opted into marketing.',
            ],
          },
        ],
      },
      {
        heading: '7. How SMS Consent is Collected',
        paragraphs: ['Consent is obtained through explicit user action, including booking forms, account registration, and dashboard inputs.', 'Users must agree via checkbox or similar action confirming the following statement:'],
        quote:
          'I agree to receive SMS notifications from R/E Pro Photos regarding my bookings, appointments, and account updates. Message and data rates may apply. Reply STOP to unsubscribe.',
        bullets: ['Consent is logged with timestamp and user details.'],
      },
      {
        heading: '8. Releases & Permissions',
        bullets: [
          'You have authority to photograph the Property.',
          'All necessary permissions from owners, tenants, and occupants are obtained.',
          'No unauthorized copyrighted or restricted materials are included.',
          'You agree to indemnify R/E Pro Photos from related claims.',
        ],
      },
      {
        heading: '9. Limitation of Liability',
        bullets: [
          'R/E Pro Photos is not liable for weather conditions.',
          'R/E Pro Photos is not liable for property readiness issues.',
          'R/E Pro Photos is not liable for access limitations.',
          'R/E Pro Photos is not liable for minor editing variations.',
          'R/E Pro Photos is not liable for third-party platform compression.',
          'Maximum liability is limited to the amount paid for the service.',
        ],
      },
      {
        heading: '10. Indemnification',
        bullets: [
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from claims arising from breach of these Terms.',
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from misuse of content.',
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from failure to obtain proper permissions.',
          'You agree to indemnify and hold harmless R/E Pro Photos and its team from negligent or intentional actions.',
        ],
      },
      {
        heading: '11. Platform Usage',
        bullets: [
          'You agree to provide accurate information.',
          'You are responsible for account security.',
          'Misuse may result in suspension or termination.',
        ],
      },
      {
        heading: '12. Modifications',
        paragraphs: ['R/E Pro Photos may update these Terms at any time. Continued use of the Platform constitutes acceptance of updated Terms.'],
      },
      {
        heading: '13. Governing Law',
        paragraphs: ['These Terms are governed by the laws of the State of Maryland.'],
      },
      {
        heading: '14. Email Communications',
        bullets: [
          'Transactional emails',
          'Service updates',
          'Optional marketing communications with opt-out available',
        ],
      },
    ],
  },
  {
    title: 'R/E Pro Photos – Photographer Agreement (With SMS Consent)',
    sections: [
      {
        heading: '1. Independent Contractor Status',
        paragraphs: ['Photographer is an independent contractor and responsible for taxes, equipment, insurance, and compliance with applicable laws.'],
      },
      {
        heading: '2. Assignment Acceptance',
        bullets: [
          'Assignments are accepted via the Platform.',
          'Accepted shoots must be completed as scheduled.',
          'Unjustified cancellations may impact platform access.',
        ],
      },
      {
        heading: '3. Professional Standards',
        bullets: [
          'Be punctual and professional.',
          'Follow company quality standards.',
          'Deliver work within required timelines.',
        ],
      },
      {
        heading: '4. Ownership of Work',
        bullets: [
          'All Work is a work made for hire.',
          'All Work is fully owned by R/E Pro Photos.',
          'Photographers may not sell or reuse content.',
          'Photographers may not share RAW files.',
          'Photographers may not deliver directly to clients.',
        ],
      },
      {
        heading: '5. SMS Consent (Photographers)',
        paragraphs: ['By using the Platform, you consent to receive SMS messages related to job assignments, scheduling updates, urgent notifications, and reminders.'],
        bullets: ['Reply STOP to unsubscribe.', 'Reply HELP for assistance.', 'Opting out may limit your ability to receive real-time assignments.'],
      },
      {
        heading: '6. Payment',
        paragraphs: ['Payment is issued per agreed terms. Company may withhold payment for incomplete or substandard work.'],
      },
      {
        heading: '7. Confidentiality',
        paragraphs: ['You agree to keep all company and client information confidential.'],
      },
      {
        heading: '8. Liability',
        paragraphs: ['Photographer is responsible for damages, injuries, and maintaining appropriate insurance.'],
      },
      {
        heading: '9. Platform Access',
        paragraphs: ['Access may be suspended or terminated for performance or policy violations.'],
      },
      {
        heading: '10. Governing Law',
        paragraphs: ['Governed by the laws of Maryland.'],
      },
    ],
  },
] as const;

export const smsConsentOptions = [
  {
    name: 'marketingSmsOptIn',
    title: 'Marketing SMS',
    description:
      'By checking this box you agree to receive Marketing SMS from R/E Pro Photos. Message frequency varies. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.',
  },
  {
    name: 'transactionalSmsOptIn',
    title: 'Transactional SMS',
    description:
      'By checking this box you agree to receive Transactional SMS communication about bookings, account notifications, and 2FA from R/E Pro Photos. Message frequency varies. Message and data rates may apply. Reply HELP for help. Reply STOP to opt out.',
  },
] as const;

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    company: z.string().optional(),
    phone: z.string().optional(),
    marketingSmsOptIn: z.boolean().optional(),
    transactionalSmsOptIn: z.boolean().optional(),
    email: z.string().email('Invalid email address'),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
    terms: z.boolean().refine((value) => value === true, {
      message: 'You must agree to the Terms & Conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export type RegisterSuccessPayload = {
  user: UserData;
  token: string;
};

export type RegisterFormProps = {
  onSuccess: (payload: RegisterSuccessPayload) => void;
  onStepChange?: (step: 1 | 2) => void;
  isActive?: boolean;
};

