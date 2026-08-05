import type { User } from '@/components/auth/AuthProvider';
import * as z from 'zod';
import type { EmailHealth, RepDetails } from '@/types/auth';

export type FormRole = 'superadmin' | 'admin' | 'editing_manager' | 'photographer' | 'client' | 'editor' | 'salesRep';
export const SALES_REP_CREATABLE_ROLE: FormRole = 'client';
export const payoutFrequencyOptions = ['weekly', 'biweekly', 'monthly'] as const;

// Timezone options for the account creation/edit form. Covers the US zones used by
// the business plus a few common international zones; values are IANA identifiers
// saved to users.timezone.
export const TIMEZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Phoenix', label: 'Mountain - no DST (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
  { value: 'UTC', label: 'UTC' },
];
export const repCategoryOptions = [
  "Residential Sales",
  "Commercial Sales",
  "Virtual Staging",
  "Aerial/Drone",
  "Floor Plans",
  "Video Packages",
  "Editing Upsell",
] as const;
export const editorCapabilityOptions = [
  { id: 'photo', label: 'Photo', description: 'Receive photo editing lanes' },
  { id: 'video', label: 'Video', description: 'Receive video editing lanes' },
] as const;

export const parseShootCcEmails = (value?: string) =>
  String(value || '')
    .split(/[\n,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export type EquipmentDraftRow = {
  id: string;
  name: string;
  serialNumber: string;
  issueDate: string;
  photos: File[];
};

export const createEquipmentDraftRow = (): EquipmentDraftRow => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  name: "",
  serialNumber: "",
  issueDate: "",
  photos: [],
});

export const formatEquipmentMoney = (amount?: number | null) => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return null;
  }

  return `$${Number(amount).toFixed(2)}`;
};

// Create schema with viewer role parameter - superadmin can skip mandatory fields
export const createAccountFormSchema = (viewerRole?: string, isEditing = false) => z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(['superadmin', 'admin', 'editing_manager', 'photographer', 'client', 'editor', 'salesRep'] as const),
  timezone: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipcode: z.string().optional(),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
  shootCcEmailsText: z.string().optional(),
  clientDiscountType: z.enum(['fixed', 'percent']).optional(),
  clientDiscountValue: z.string().optional(),
  avatar: z.string().optional(),
  companyNotes: z.string().optional(),
  bio: z.string().optional(),
  isActive: z.boolean().default(true),
  specialties: z.array(z.string()).optional(),
  editingCapabilities: z.array(z.string()).optional(),
  travelRange: z.number().optional(),
  travelRangeUnit: z.enum(['miles', 'km']).optional(),
  pilotLicenseFile: z.string().optional(),
  pilotLicenseFileName: z.string().optional(),
  insuranceNumber: z.string().optional(),
  insuranceFile: z.string().optional(),
  insuranceFileName: z.string().optional(),
  repHomeStreet: z.string().optional(),
  repHomeStreet2: z.string().optional(),
  repHomeCity: z.string().optional(),
  repHomeState: z.string().optional(),
  repHomeZip: z.string().optional(),
  repCommissionRate: z.string().optional(),
  repSalesCategories: z.array(z.string()).optional(),
  repPayoutEmail: z.string().optional(),
  repPayoutFrequency: z.enum(payoutFrequencyOptions).optional(),
  repAutoApprovePayouts: z.boolean().optional(),
  repCanTextClients: z.boolean().optional(),
  repNotes: z.string().optional(),
  created_by_name: z.string().optional(),
  created_by_id: z.coerce.string().optional(),
  serviceGroupIds: z.array(z.string()).optional(),
})
.superRefine((data, ctx) => {
  const isSalesRepViewer = viewerRole === 'salesRep';

  // License number required for clients except for superadmins and sales reps
  if (!isEditing && data.role === "client" && !data.licenseNumber?.trim() && viewerRole !== 'superadmin' && !isSalesRepViewer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "License number is required for clients",
      path: ["licenseNumber"],
    });
  }

  // City, State, Zip required for non-salesRep roles (superadmin can skip)
  if (!isEditing && data.role !== "salesRep" && viewerRole !== 'superadmin') {
    if (!data.city?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "City is required",
        path: ["city"],
      });
    }
    if (!data.state?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "State is required",
        path: ["state"],
      });
    }
    if (!data.zipcode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Zip Code is required",
        path: ["zipcode"],
      });
    }
  }

  const ccEmails = parseShootCcEmails(data.shootCcEmailsText);
  const invalidCcEmail = ccEmails.find((email) => !z.string().email().safeParse(email).success);
  if (invalidCcEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid email: ${invalidCcEmail}`,
      path: ["shootCcEmailsText"],
    });
  }

  if (data.role === "client") {
    const discountValue = data.clientDiscountValue?.trim() || '';
    if (discountValue && !data.clientDiscountType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a discount type before entering a discount value",
        path: ["clientDiscountType"],
      });
    }
  }

  if (data.role === "editor" && (!Array.isArray(data.editingCapabilities) || data.editingCapabilities.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one editing capability",
      path: ["editingCapabilities"],
    });
  }
});

// Default schema for type inference
const accountFormSchema = createAccountFormSchema();

type AccountFormSchemaValues = z.infer<typeof accountFormSchema>;

export type AccountFormValues = Omit<
  AccountFormSchemaValues,
  'clientDiscountType' | 'clientDiscountValue'
> & {
  clientDiscountType?: 'fixed' | 'percent' | null;
  clientDiscountValue?: string | number | null;
  name?: string;
  id?: string;
  metadata?: {
    repDetails?: RepDetails;
    [key: string]: unknown;
  };
  createdBy?: string;
  shootCcEmails?: string[];
  shoot_cc_emails?: string[];
  client_discount_type?: 'fixed' | 'percent' | null;
  client_discount_value?: number | null;
  email_health?: EmailHealth;
  service_group_ids?: string[];
  service_groups?: Array<{ id: string; name: string; description?: string }>;
};

export type AccountFormUser = User & {
  created_by_id?: string | number;
  created_by_name?: string;
  createdBy?: string;
  licenseNumber?: string;
  license_number?: string;
  specialties?: string[];
  editingCapabilities?: string[];
};

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export const getRequestErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  const response = asRecord(asRecord(error).response);
  const data = asRecord(response.data);
  return typeof data.message === 'string' && data.message ? data.message : fallback;
};


export interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AccountFormValues) => void;
  initialData?: AccountFormUser;
}


