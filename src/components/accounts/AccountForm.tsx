import React, { useState, useEffect } from "react"; 
import { User, Role } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ImageUpload } from "@/components/profile/ImageUpload";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import { FileUploadModal } from "@/components/accounts/FileUploadModal";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/env";
import type { EmailHealth, RepDetails } from "@/types/auth";
import { STATE_OPTIONS } from "@/utils/stateUtils";
import { Upload, FileText, X, Camera, Loader2, MapPin, Plus, Wrench } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useServices } from "@/hooks/useServices";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import { useServiceGroups } from "@/hooks/useServiceGroups";
import { PhoneInput } from "@/components/ui/phone-input";
import { usePermission } from "@/hooks/usePermission";
import { MultiSelectChecklist } from "@/components/ui/multi-select-checklist";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useQueryClient } from "@tanstack/react-query";
import { analyzeEmailInput, normalizeEmailHealth } from "@/utils/emailHealth";
import { getCategorySpecialtyId } from "@/utils/photographerSpecialties";
import { listAdminPhotographerEquipments, type PhotographerEquipment } from "@/services/photographerEquipmentService";

// Define allowed roles for the form
type FormRole = 'superadmin' | 'admin' | 'editing_manager' | 'photographer' | 'client' | 'editor' | 'salesRep';
const SALES_REP_CREATABLE_ROLE: FormRole = 'client';
const payoutFrequencyOptions = ['weekly', 'biweekly', 'monthly'] as const;
const repCategoryOptions = [
  "Residential Sales",
  "Commercial Sales",
  "Virtual Staging",
  "Aerial/Drone",
  "Floor Plans",
  "Video Packages",
  "Editing Upsell",
] as const;
const editorCapabilityOptions = [
  { id: 'photo', label: 'Photo', description: 'Receive photo editing lanes' },
  { id: 'video', label: 'Video', description: 'Receive video editing lanes' },
] as const;

const parseShootCcEmails = (value?: string) =>
  String(value || '')
    .split(/[\n,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

type EquipmentDraftRow = {
  id: string;
  name: string;
  serialNumber: string;
  issueDate: string;
  photos: File[];
};

const createEquipmentDraftRow = (): EquipmentDraftRow => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  name: "",
  serialNumber: "",
  issueDate: "",
  photos: [],
});

// Create schema with viewer role parameter - superadmin can skip mandatory fields
const createAccountFormSchema = (viewerRole?: string) => z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(['superadmin', 'admin', 'editing_manager', 'photographer', 'client', 'editor', 'salesRep'] as const),
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
  created_by_id: z.string().optional(),
  serviceGroupIds: z.array(z.string()).optional(),
})
.superRefine((data, ctx) => {
  const isSalesRepViewer = viewerRole === 'salesRep';

  // License number required for clients except for superadmins and sales reps
  if (data.role === "client" && !data.licenseNumber?.trim() && viewerRole !== 'superadmin' && !isSalesRepViewer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "License number is required for clients",
      path: ["licenseNumber"],
    });
  }

  // City, State, Zip required for non-salesRep roles (superadmin can skip)
  if (data.role !== "salesRep" && viewerRole !== 'superadmin') {
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

export type AccountFormValues = z.infer<typeof accountFormSchema> & {
  name?: string;
  id?: string;
  metadata?: {
    repDetails?: RepDetails;
    [key: string]: any;
  };
};



interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AccountFormValues) => void;
  initialData?: User;
}

export function AccountForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: AccountFormProps) {
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [adminsAndReps, setAdminsAndReps] = useState<Array<{id: string, name: string}>>([]);
  const [pilotLicenseModalOpen, setPilotLicenseModalOpen] = useState(false);
  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [emailWarningOverride, setEmailWarningOverride] = useState(false);
  const [equipmentRows, setEquipmentRows] = useState<EquipmentDraftRow[]>([]);
  const [existingEquipmentOptions, setExistingEquipmentOptions] = useState<PhotographerEquipment[]>([]);
  const [selectedExistingEquipmentIds, setSelectedExistingEquipmentIds] = useState<string[]>([]);
  const [serverEmailHealth, setServerEmailHealth] = useState<EmailHealth | undefined>(
    normalizeEmailHealth(initialData?.email_health),
  );
  const { toast } = useToast();
  const { role: viewerRole, user: currentUser } = useAuth();
  const permission = usePermission();
  const clientsPermission = permission.forResource('clients');
  const canEditSensitiveRepFields = viewerRole === 'superadmin';
  const queryClient = useQueryClient();
  
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(createAccountFormSchema(viewerRole)),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "client" as FormRole,
      phone: "",
      address: "",
      city: "",
      state: "",
      zipcode: "",
      company: "",
      licenseNumber: "",
      shootCcEmailsText: "",
      clientDiscountType: undefined,
      clientDiscountValue: "",
      avatar: "",
      bio: "",
          companyNotes: "",
          isActive: true,
          specialties: [],
          editingCapabilities: ['photo', 'video'],
          travelRange: 25,
          travelRangeUnit: 'miles' as const,
          pilotLicenseFile: "",
          pilotLicenseFileName: "",
          insuranceNumber: "",
          insuranceFile: "",
          insuranceFileName: "",
          repHomeStreet: "",
      repHomeStreet2: "",
      repHomeCity: "",
      repHomeState: "",
      repHomeZip: "",
      repCommissionRate: "",
      repSalesCategories: [],
      repPayoutEmail: "",
      repPayoutFrequency: "weekly",
      repAutoApprovePayouts: false,
      repCanTextClients: true,
      repNotes: "",
      created_by_name: "",
      created_by_id: "",
      serviceGroupIds: [],
    },
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        const role: FormRole = initialData.role === 'superadmin'
          ? 'admin'
          : (initialData.role as FormRole);
        const [firstName = '', ...rest] = (initialData.name || '').trim().split(' ');
        const lastName = rest.join(' ').trim();
        const repDetails = (initialData.metadata?.repDetails as RepDetails | undefined) || {};
        const repAddress = repDetails?.homeAddress || {};

        const repMetadata = (initialData.metadata as Record<string, any> | undefined) || {};
        const repMetaId = repMetadata.accountRepId || repMetadata.account_rep_id || repMetadata.repId || repMetadata.rep_id;
        const repMetaName = repMetadata.accountRep || repMetadata.account_rep || repMetadata.rep;
        const createdById = (initialData as any).created_by_id || repMetaId || "";
        const createdByName = (initialData as any).created_by_name || (initialData as any).createdBy || repMetaName || "";

        form.reset({
          firstName,
          lastName,
          email: initialData.email,
          role,
          phone: initialData.phone || "",
          address: initialData.address || "",
          city: initialData.city || "",
          state: initialData.state || "",
          zipcode: initialData.zipcode || "",
          company: initialData.company || "",
          licenseNumber: (initialData as any).licenseNumber || (initialData as any).license_number || "",
          shootCcEmailsText: Array.isArray((initialData as any).shootCcEmails ?? (initialData as any).shoot_cc_emails)
            ? ((initialData as any).shootCcEmails ?? (initialData as any).shoot_cc_emails).join('\n')
            : "",
          clientDiscountType: ((initialData as any).clientDiscountType ?? (initialData as any).client_discount_type ?? undefined) || undefined,
          clientDiscountValue: ((initialData as any).clientDiscountValue ?? (initialData as any).client_discount_value) !== undefined
            && ((initialData as any).clientDiscountValue ?? (initialData as any).client_discount_value) !== null
            ? String((initialData as any).clientDiscountValue ?? (initialData as any).client_discount_value)
            : "",
          avatar: initialData.avatar || "",
          companyNotes: initialData.companyNotes || "",
          isActive: initialData.isActive !== undefined ? initialData.isActive : true,
          specialties: (initialData.metadata?.specialties as string[]) ?? (initialData as any).specialties ?? [],
          editingCapabilities: (initialData.metadata?.editing_capabilities as string[])
            ?? (initialData as any).editingCapabilities
            ?? (role === 'editor' ? ['photo', 'video'] : []),
          travelRange: Number(initialData.metadata?.travel_range) || 25,
          travelRangeUnit: (initialData.metadata?.travel_range_unit as 'miles' | 'km') || 'miles',
          pilotLicenseFile: initialData.metadata?.pilotLicenseFile || "",
          pilotLicenseFileName: initialData.metadata?.pilotLicenseFileName || "",
          insuranceNumber: initialData.metadata?.insuranceNumber || "",
          insuranceFile: initialData.metadata?.insuranceFile || "",
          insuranceFileName: initialData.metadata?.insuranceFileName || "",
          repHomeStreet: repAddress.line1 || "",
          repHomeStreet2: repAddress.line2 || "",
          repHomeCity: repAddress.city || "",
          repHomeState: repAddress.state || "",
          repHomeZip: repAddress.postalCode || "",
          repCommissionRate: repDetails?.commissionPercentage !== undefined ? String(repDetails.commissionPercentage) : "",
          repSalesCategories: repDetails?.salesCategories || [],
          repPayoutEmail: repDetails?.payoutEmail || initialData.email || "",
          repPayoutFrequency: repDetails?.payoutFrequency || "weekly",
          repAutoApprovePayouts: repDetails?.autoApprovePayouts ?? false,
          repCanTextClients: repDetails?.smsEnabled ?? true,
          repNotes: repDetails?.notes || "",
          created_by_name: createdByName,
          created_by_id: createdById,
          serviceGroupIds: Array.isArray((initialData as any).service_group_ids)
            ? (initialData as any).service_group_ids.map((id: any) => String(id))
            : Array.isArray((initialData as any).service_groups)
              ? (initialData as any).service_groups.map((group: any) => String(group.id))
              : [],
        });
        setAvatarUrl(initialData.avatar || "");
        setEquipmentRows([]);
        setSelectedExistingEquipmentIds([]);
      } else {
        form.reset({
          firstName: "",
          lastName: "",
          email: "",
          role: "client",
          phone: "",
          address: "",
          city: "",
          state: "",
          zipcode: "",
          company: "",
          licenseNumber: "",
          shootCcEmailsText: "",
          clientDiscountType: undefined,
          clientDiscountValue: "",
          avatar: "",
          bio: "",
          companyNotes: "",
          isActive: true,
          specialties: [],
          editingCapabilities: ['photo', 'video'],
          travelRange: 25,
          travelRangeUnit: 'miles' as const,
          pilotLicenseFile: "",
          pilotLicenseFileName: "",
          insuranceNumber: "",
          insuranceFile: "",
          insuranceFileName: "",
          repHomeStreet: "",
          repHomeStreet2: "",
          repHomeCity: "",
          repHomeState: "",
          repHomeZip: "",
          repCommissionRate: "",
          repSalesCategories: [],
          repPayoutEmail: "",
          repPayoutFrequency: "weekly",
          repAutoApprovePayouts: false,
          repCanTextClients: true,
          repNotes: "",
          created_by_name: "",
          created_by_id: "",
          serviceGroupIds: [],
        });

        if (viewerRole === 'salesRep' && currentUser?.id) {
          form.setValue('created_by_id', String(currentUser.id), { shouldValidate: false, shouldDirty: false });
          form.setValue('created_by_name', currentUser.name || '', { shouldValidate: false, shouldDirty: false });
        }

        setAvatarUrl("");
        setEquipmentRows([]);
        setSelectedExistingEquipmentIds([]);
      }
    }
  }, [currentUser?.id, currentUser?.name, initialData, form, open, viewerRole]);

  const updateEquipmentRow = (rowId: string, patch: Partial<EquipmentDraftRow>) => {
    setEquipmentRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const addEquipmentRow = () => {
    setEquipmentRows((rows) => [...rows, createEquipmentDraftRow()]);
  };

  const removeEquipmentRow = (rowId: string) => {
    setEquipmentRows((rows) => rows.filter((row) => row.id !== rowId));
  };

  const activeEquipmentRows = React.useMemo(
    () => equipmentRows.filter((row) => row.name.trim()),
    [equipmentRows],
  );

  const repMetadata = (initialData?.metadata as Record<string, any> | undefined) || {};
  const repMetaId = repMetadata.accountRepId || repMetadata.account_rep_id || repMetadata.repId || repMetadata.rep_id;
  const repMetaName = repMetadata.accountRep || repMetadata.account_rep || repMetadata.rep;
  const createdById = (initialData as any)?.created_by_id || repMetaId || "";
  const createdByName = (initialData as any)?.created_by_name || (initialData as any)?.createdBy || repMetaName || "";
  const formCreatedById = form.watch("created_by_id");
  const formCreatedByName = form.watch("created_by_name");
  const currentRole = form.watch("role");
  const currentEmail = form.watch("email");
  const isClientRole = currentRole === "client";

  useEffect(() => {
    if (!open || currentRole !== "photographer" || initialData) {
      return;
    }

    listAdminPhotographerEquipments()
      .then((items) => setExistingEquipmentOptions(items.filter((item) => !item.photographer_id)))
      .catch((error) => {
        console.error("Failed to load unassigned equipment", error);
        setExistingEquipmentOptions([]);
      });
  }, [currentRole, initialData, open]);

  const localEmailHint = React.useMemo(() => analyzeEmailInput(currentEmail || ""), [currentEmail]);
  const emailHelpState = React.useMemo(() => {
    if (!isClientRole) {
      return null;
    }

    if (localEmailHint.level !== 'none') {
      return {
        level: localEmailHint.level,
        message: localEmailHint.message,
        suggestedCorrection: localEmailHint.suggestedCorrection,
        requiresConfirmation: localEmailHint.requiresConfirmation,
      };
    }

    if (serverEmailHealth?.warning_message || serverEmailHealth?.status) {
      return {
        level: serverEmailHealth?.status === 'bounced' || serverEmailHealth?.status === 'invalid' ? 'error' : 'info',
        message: serverEmailHealth?.warning_message || 'This email will stay limited until it is verified.',
        suggestedCorrection: serverEmailHealth?.suggested_correction || undefined,
        requiresConfirmation: serverEmailHealth?.requires_confirmation,
      };
    }

    return null;
  }, [isClientRole, localEmailHint, serverEmailHealth]);

  useEffect(() => {
    setEmailWarningOverride(false);
    setServerEmailHealth(normalizeEmailHealth(initialData?.email_health));
  }, [initialData?.email_health, open]);

  useEffect(() => {
    setEmailWarningOverride(false);
    if (!initialData || currentEmail === initialData.email) {
      return;
    }

    setServerEmailHealth(undefined);
  }, [currentEmail, initialData]);

  useEffect(() => {
    if (!open || viewerRole !== 'salesRep') return;

    const nextRole: FormRole = initialData?.role ? (initialData.role as FormRole) : SALES_REP_CREATABLE_ROLE;
    const currentValue = form.getValues('role');

    if (!initialData && currentValue !== SALES_REP_CREATABLE_ROLE) {
      form.setValue('role', nextRole, { shouldValidate: true });
    }
  }, [form, initialData?.role, open, viewerRole]);

  const displayedRepId = formCreatedById || createdById || (viewerRole === 'salesRep' && currentUser?.id ? String(currentUser.id) : "");
  const displayedRepName = formCreatedByName || createdByName || (viewerRole === 'salesRep' ? currentUser?.name || '' : "");
  const repAssigned = Boolean(displayedRepId || displayedRepName);
  const canAssignClientRep = viewerRole === 'superadmin' || (viewerRole === 'admin' && clientsPermission.canAssign());
  const { data: serviceGroups = [] } = useServiceGroups({
    enabled: open && isClientRole && ['admin', 'superadmin', 'editing_manager', 'salesRep'].includes(viewerRole),
  });
  const serviceGroupOptions = React.useMemo(
    () =>
      serviceGroups.map((group) => ({
        id: group.id,
        label: group.name,
        description: group.description || undefined,
        meta: `${group.service_count} services • ${group.client_count} clients`,
      })),
    [serviceGroups],
  );

  // Fetch admins and reps for account rep dropdown
  useEffect(() => {
    const shouldFetch = open && (viewerRole === 'superadmin' || canAssignClientRep);
    
    if (shouldFetch) {
      const fetchAdminsAndReps = async () => {
        try {
          const token = localStorage.getItem('authToken') || localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            const users = data.users || [];
            // Filter to only admins and salesReps
            const filtered = users
              .filter((u: any) => u.role === 'admin' || u.role === 'salesRep' || u.role === 'superadmin')
              .map((u: any) => ({ id: String(u.id), name: u.name || u.email }));
            setAdminsAndReps(filtered);
          }
        } catch (err) {
          console.error('Failed to fetch admins and reps:', err);
        }
      };
      fetchAdminsAndReps();
    }
  }, [viewerRole, open, canAssignClientRep]);

  const buildRepDetails = (values: AccountFormValues): RepDetails | undefined => {
    const existingDetails = (initialData?.metadata?.repDetails as RepDetails | undefined) || undefined;

    if (values.role !== 'salesRep') {
      return existingDetails;
    }

    const details: RepDetails = {};

    if (canEditSensitiveRepFields) {
      const homeAddress = {
        line1: values.repHomeStreet?.trim() || undefined,
        line2: values.repHomeStreet2?.trim() || undefined,
        city: values.repHomeCity?.trim() || undefined,
        state: values.repHomeState?.trim() || undefined,
        postalCode: values.repHomeZip?.trim() || undefined,
      };
      const cleanedHomeAddress = Object.fromEntries(
        Object.entries(homeAddress).filter(([, value]) => value && String(value).length)
      ) as RepDetails['homeAddress'];
      if (cleanedHomeAddress && Object.keys(cleanedHomeAddress).length) {
        details.homeAddress = cleanedHomeAddress;
      }

      if (values.repCommissionRate?.trim()) {
        const commission = parseFloat(values.repCommissionRate);
        if (!Number.isNaN(commission)) {
          details.commissionPercentage = Number(commission.toFixed(2));
        }
      }
    } else if (existingDetails?.homeAddress) {
      details.homeAddress = existingDetails.homeAddress;
    }

    if (!canEditSensitiveRepFields && existingDetails?.commissionPercentage !== undefined) {
      details.commissionPercentage = existingDetails.commissionPercentage;
    }

    if (Array.isArray(values.repSalesCategories) && values.repSalesCategories.length) {
      details.salesCategories = values.repSalesCategories;
    }

    const payoutEmail = values.repPayoutEmail?.trim() || existingDetails?.payoutEmail || values.email;
    if (payoutEmail) {
      details.payoutEmail = payoutEmail;
    }

    if (values.repPayoutFrequency) {
      details.payoutFrequency = values.repPayoutFrequency;
    }

    if (typeof values.repAutoApprovePayouts === 'boolean') {
      details.autoApprovePayouts = values.repAutoApprovePayouts;
    }

    if (typeof values.repCanTextClients === 'boolean') {
      details.smsEnabled = values.repCanTextClients;
    }

    if (values.repNotes?.trim()) {
      details.notes = values.repNotes.trim();
    }

    if (details.salesCategories && !details.salesCategories.length) {
      delete details.salesCategories;
    }

    if (details.homeAddress) {
      const cleaned = Object.fromEntries(
        Object.entries(details.homeAddress).filter(([, value]) => value && String(value).length)
      ) as RepDetails['homeAddress'];
      if (cleaned && Object.keys(cleaned).length) {
        details.homeAddress = cleaned;
      } else {
        delete details.homeAddress;
      }
    }

    const cleanedEntries = Object.entries(details).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
      return value !== undefined;
    });

    if (!cleanedEntries.length) {
      return existingDetails;
    }

    return Object.fromEntries(cleanedEntries) as RepDetails;
  };

  const handleSubmit = async (values: AccountFormValues) => {
    console.log("Form submitted with values:", values);

    if (viewerRole === 'salesRep' && !initialData && values.role !== SALES_REP_CREATABLE_ROLE) {
      toast({
        title: 'Role not allowed',
        description: 'Sales reps can only create client accounts.',
        variant: 'destructive',
      });
      return;
    }

    const fullName = `${values.firstName} ${values.lastName}`.trim();
    const parsedShootCcEmails = values.role === 'client' ? parseShootCcEmails(values.shootCcEmailsText) : [];
    const normalizedDiscountType = values.role === 'client'
      ? values.clientDiscountType || null
      : null;
    const normalizedDiscountValue = values.role === 'client' && values.clientDiscountValue?.trim()
      ? Number(values.clientDiscountValue)
      : null;
    const normalizedEditingCapabilities = values.role === 'editor'
      ? editorCapabilityOptions
          .map((option) => option.id)
          .filter((capability) => Array.isArray(values.editingCapabilities) && values.editingCapabilities.includes(capability))
      : [];
    const payload: AccountFormValues = {
      ...values,
      name: fullName,
    };
    if (avatarUrl) {
      payload.avatar = avatarUrl;
    }

    const repDetails = buildRepDetails(values);
    const metadataPayload = { ...(initialData?.metadata || {}) };
    if (repDetails) {
      metadataPayload.repDetails = repDetails;
    } else if (metadataPayload.repDetails) {
      delete metadataPayload.repDetails;
    }

    if (values.role === 'editor') {
      metadataPayload.editing_capabilities = normalizedEditingCapabilities;
    } else if ('editing_capabilities' in metadataPayload) {
      delete metadataPayload.editing_capabilities;
    }

    // Add photographer-specific data to metadata
    if (values.role === 'photographer') {
      if (values.pilotLicenseFile) {
        metadataPayload.pilotLicenseFile = values.pilotLicenseFile;
      }
      if (values.pilotLicenseFileName) {
        metadataPayload.pilotLicenseFileName = values.pilotLicenseFileName;
      }
      if (values.insuranceNumber) {
        metadataPayload.insuranceNumber = values.insuranceNumber;
      }
      if (values.insuranceFile) {
        metadataPayload.insuranceFile = values.insuranceFile;
      }
      if (values.insuranceFileName) {
        metadataPayload.insuranceFileName = values.insuranceFileName;
      }
      if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
        metadataPayload.specialties = values.specialties;
      }
      if (values.travelRange !== undefined) {
        metadataPayload.travel_range = values.travelRange;
      }
      if (values.travelRangeUnit) {
        metadataPayload.travel_range_unit = values.travelRangeUnit;
      }
    }

    if (Object.keys(metadataPayload).length) {
      payload.metadata = metadataPayload;
    }

    const canAssignRepForPayload = canEditCreatedBy || (canAssignClientRep && values.role === 'client');
    const shouldSendEmailOverride = values.role === 'client' && emailWarningOverride;

    // If editing, include created_by fields if superadmin or permitted admin is assigning a rep
    if (initialData && canAssignRepForPayload) {
      if (values.created_by_name) {
        payload.created_by_name = values.created_by_name;
      }
      if (values.created_by_id) {
        payload.created_by_id = values.created_by_id;
      }
    }

    // If editing, call update API
    if (initialData) {
      try {
        setSubmitting(true);
        const token = (typeof window !== 'undefined') ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;
        if (!token) {
          throw new Error('Not authenticated');
        }

        const formData = new FormData();
        formData.append('_method', 'PUT');
        formData.append('name', fullName || '');
        formData.append('email', values.email || '');
        if (shouldSendEmailOverride) formData.append('email_warning_override', '1');
        if (values.phone) formData.append('phone_number', values.phone);
        if (values.company) formData.append('company_name', values.company);
        if (values.address) formData.append('address', values.address);
        if (values.city) formData.append('city', values.city);
        if (values.state) formData.append('state', values.state);
        if (values.zipcode) formData.append('zip', values.zipcode);
        if (values.licenseNumber) formData.append('license_number', values.licenseNumber);
        if (values.companyNotes) formData.append('company_notes', values.companyNotes);
        if (parsedShootCcEmails.length > 0) {
          parsedShootCcEmails.forEach((email) => formData.append('shoot_cc_emails[]', email));
        } else {
          formData.append('clear_shoot_cc_emails', '1');
        }
        formData.append('client_discount_type', normalizedDiscountType ?? '');
        formData.append('client_discount_value', normalizedDiscountValue !== null ? String(normalizedDiscountValue) : '');
        formData.append('role', values.role || 'client');
        if (values.bio) formData.append('bio', values.bio);
        // Only include avatar if it's a valid URL (not a blob URL)
        if (avatarUrl && !avatarUrl.startsWith('blob:')) {
          formData.append('avatar', avatarUrl);
        }
        if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
          formData.append('specialties', JSON.stringify(values.specialties));
        }
        if (values.role === 'editor') {
          formData.append('editing_capabilities', JSON.stringify(normalizedEditingCapabilities));
        }
        if (values.pilotLicenseFile) formData.append('pilotLicenseFile', values.pilotLicenseFile);
        if (values.pilotLicenseFileName) formData.append('pilotLicenseFileName', values.pilotLicenseFileName);
        if (values.insuranceNumber) formData.append('insuranceNumber', values.insuranceNumber);
        if (values.insuranceFile) formData.append('insuranceFile', values.insuranceFile);
        if (values.insuranceFileName) formData.append('insuranceFileName', values.insuranceFileName);
        if (isClientRole && Array.isArray(values.serviceGroupIds)) {
          values.serviceGroupIds.forEach((id) => formData.append('service_group_ids[]', id));
        }
        
        if (payload.metadata) {
          formData.append('metadata', JSON.stringify(payload.metadata));
        }

        if (canAssignRepForPayload) {
          if (values.created_by_name) {
            formData.append('created_by_name', values.created_by_name);
          }
          if (values.created_by_id) {
            formData.append('created_by_id', String(values.created_by_id));
          }
        }

        const res = await fetch(`${API_BASE_URL}/api/admin/users/${initialData.id}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: formData,
        });

        if (!res.ok) {
          const bodyText = await res.text();
          let message = 'Failed to update user';
          try {
            const errorPayload = JSON.parse(bodyText);
            const nextEmailHealth = normalizeEmailHealth(errorPayload?.email_health);
            if (nextEmailHealth) {
              setServerEmailHealth(nextEmailHealth);
            }

            const emailMessage = Array.isArray(errorPayload?.errors?.email)
              ? errorPayload.errors.email[0]
              : errorPayload?.message;

            if (emailMessage) {
              form.setError('email', {
                type: 'server',
                message: emailMessage,
              });
              message = emailMessage;
            } else if (bodyText) {
              message = bodyText;
            }
          } catch {
            if (bodyText) {
              message = bodyText;
            }
          }

          throw new Error(message);
        }

        const json = await res.json();
        const updated = json.user;
        setServerEmailHealth(normalizeEmailHealth(updated?.email_health));

        onSubmit({
          ...values,
          name: updated.name,
          firstName: values.firstName,
          lastName: values.lastName,
          email: updated.email,
          role: updated.role,
          phone: updated.phone_number,
          company: updated.company_name,
          avatar: updated.avatar,
          bio: updated.bio,
          id: String(updated.id),
          metadata: payload.metadata,
          created_by_name: updated.created_by_name || currentUser?.name,
          createdBy: updated.created_by_name || currentUser?.name,
          shootCcEmails: parsedShootCcEmails,
          shoot_cc_emails: parsedShootCcEmails,
          clientDiscountType: normalizedDiscountType,
          client_discount_type: normalizedDiscountType,
          clientDiscountValue: normalizedDiscountValue,
          client_discount_value: normalizedDiscountValue,
          email_health: normalizeEmailHealth(updated?.email_health),
          serviceGroupIds: values.serviceGroupIds,
          service_group_ids: values.serviceGroupIds,
          service_groups: serviceGroups.filter((group) => values.serviceGroupIds?.includes(group.id)).map((group) => ({
            id: group.id,
            name: group.name,
            description: group.description,
          })),
        } as any);

        toast({ title: 'User updated', description: `${updated.name} updated successfully.` });
        if (values.role === 'client') {
          queryClient.invalidateQueries({ queryKey: ['service-groups'] });
        }
        onOpenChange(false);
      } catch (e: any) {
        console.error('Update account failed', e);
        toast({ title: 'Update failed', description: e?.message || 'Unable to update user', variant: 'destructive' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Creating: call backend API here
    try {
      setSubmitting(true);
      const token = (typeof window !== 'undefined') ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('name', fullName || '');
      formData.append('email', values.email || '');
      if (shouldSendEmailOverride) formData.append('email_warning_override', '1');
      if (values.phone) formData.append('phone_number', values.phone);
      if (values.company) formData.append('company_name', values.company);
      if (values.address) formData.append('address', values.address);
      if (values.city) formData.append('city', values.city);
      if (values.state) formData.append('state', values.state);
      if (values.zipcode) formData.append('zip', values.zipcode);
      if (values.licenseNumber) formData.append('license_number', values.licenseNumber);
      if (values.companyNotes) formData.append('company_notes', values.companyNotes);
      if (parsedShootCcEmails.length > 0) {
        parsedShootCcEmails.forEach((email) => formData.append('shoot_cc_emails[]', email));
      } else {
        formData.append('clear_shoot_cc_emails', '1');
      }
      formData.append('client_discount_type', normalizedDiscountType ?? '');
      formData.append('client_discount_value', normalizedDiscountValue !== null ? String(normalizedDiscountValue) : '');
      formData.append('role', values.role || 'client');
      if (values.bio) formData.append('bio', values.bio);
        if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
          formData.append('specialties', JSON.stringify(values.specialties));
        }
      if (values.role === 'editor') {
        formData.append('editing_capabilities', JSON.stringify(normalizedEditingCapabilities));
      }
      if (values.pilotLicenseFile) formData.append('pilotLicenseFile', values.pilotLicenseFile);
      if (values.pilotLicenseFileName) formData.append('pilotLicenseFileName', values.pilotLicenseFileName);
      if (values.insuranceNumber) formData.append('insuranceNumber', values.insuranceNumber);
      if (values.insuranceFile) formData.append('insuranceFile', values.insuranceFile);
      if (values.insuranceFileName) formData.append('insuranceFileName', values.insuranceFileName);
      if (isClientRole && Array.isArray(values.serviceGroupIds)) {
        values.serviceGroupIds.forEach((id) => formData.append('service_group_ids[]', id));
      }
      
      // Set created_by fields
      // If superadmin selected a creator, use that; otherwise use current user
      if (canAssignRepForPayload && values.created_by_id && values.created_by_name) {
        formData.append('created_by_name', values.created_by_name);
        formData.append('created_by_id', String(values.created_by_id));
      } else if (currentUser) {
        // Default to current user if no creator selected
        formData.append('created_by_name', currentUser.name || '');
        if (currentUser.id) {
          formData.append('created_by_id', String(currentUser.id));
        }
      }
      
      if (payload.metadata) {
        formData.append('metadata', JSON.stringify(payload.metadata));
      }

      if (values.role === 'photographer' && activeEquipmentRows.length > 0) {
        formData.append('equipments', JSON.stringify(activeEquipmentRows.map((row) => ({
          name: row.name.trim(),
          serial_number: row.serialNumber.trim(),
          issue_date: row.issueDate || null,
        }))));
        activeEquipmentRows.forEach((row, index) => {
          row.photos.forEach((file) => {
            formData.append(`equipment_reference_photos[${index}][]`, file);
          });
        });
      }
      if (values.role === 'photographer' && selectedExistingEquipmentIds.length > 0) {
        selectedExistingEquipmentIds.forEach((id) => formData.append('existing_equipment_ids[]', id));
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      if (!res.ok) {
        const bodyText = await res.text();
        let message = 'Failed to create user';
        try {
          const errorPayload = JSON.parse(bodyText);
          const nextEmailHealth = normalizeEmailHealth(errorPayload?.email_health);
          if (nextEmailHealth) {
            setServerEmailHealth(nextEmailHealth);
          }

          const emailMessage = Array.isArray(errorPayload?.errors?.email)
            ? errorPayload.errors.email[0]
            : errorPayload?.message;

          if (emailMessage) {
            form.setError('email', {
              type: 'server',
              message: emailMessage,
            });
            message = emailMessage;
          } else if (bodyText) {
            message = bodyText;
          }
        } catch {
          if (bodyText) {
            message = bodyText;
          }
        }

        throw new Error(message);
      }

      const json = await res.json();
      const created = json.user;
      setServerEmailHealth(normalizeEmailHealth(created?.email_health));

      // Inform parent so it can update local list (include id)
      onSubmit({
        ...values,
        name: created.name,
        firstName: values.firstName,
        lastName: values.lastName,
        email: created.email,
        role: created.role,
        phone: created.phone_number,
        company: created.company_name,
        avatar: created.avatar,
        bio: created.bio,
        id: String(created.id),
        metadata: payload.metadata,
        created_by_name: created.created_by_name || currentUser?.name,
        createdBy: created.created_by_name || currentUser?.name,
        shootCcEmails: parsedShootCcEmails,
        shoot_cc_emails: parsedShootCcEmails,
        clientDiscountType: normalizedDiscountType,
        client_discount_type: normalizedDiscountType,
        clientDiscountValue: normalizedDiscountValue,
        client_discount_value: normalizedDiscountValue,
        email_health: normalizeEmailHealth(created?.email_health),
        serviceGroupIds: values.serviceGroupIds,
        service_group_ids: values.serviceGroupIds,
        service_groups: serviceGroups.filter((group) => values.serviceGroupIds?.includes(group.id)).map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
        })),
      } as any);

      toast({ title: 'User created', description: `${created.name} added successfully.` });
      if (values.role === 'client') {
        queryClient.invalidateQueries({ queryKey: ['service-groups'] });
      }
      onOpenChange(false);
    } catch (e: any) {
      console.error('Create account failed', e);
      toast({ title: 'Create failed', description: e?.message || 'Unable to create user', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Dynamic services from API (synced with Scheduling Settings)
  // Photographer capabilities are selected by category. Legacy service IDs are still recognized.
  const { data: servicesData, isLoading: isLoadingServices } = useServices();
  const { data: serviceCategoriesData, isLoading: isLoadingCategories } = useServiceCategories();
  const serviceOptions = React.useMemo(() => {
    if (!servicesData || servicesData.length === 0) return [];
    return servicesData.filter((s) => s.active !== false);
  }, [servicesData]);
  const serviceCategories = React.useMemo(() => {
    if (!Array.isArray(serviceCategoriesData)) return [];

    return serviceCategoriesData
      .map((category: any) => ({
        id: String(category.id),
        name: String(category.name || '').trim(),
      }))
      .filter((category) => category.id && category.name);
  }, [serviceCategoriesData]);

  const categoryCapabilityOptions = React.useMemo(() => {
    const groups = new Map<string, { id: string; label: string; services: typeof serviceOptions }>();

    for (const category of serviceCategories) {
      const id = getCategorySpecialtyId(category);
      groups.set(id, { id, label: category.name, services: [] });
    }

    for (const s of serviceOptions) {
      const label = s.category || 'Other';
      const id = getCategorySpecialtyId({ id: s.category_id, name: label });
      const existing = groups.get(id);

      if (existing) {
        existing.services.push(s);
      } else {
        groups.set(id, { id, label, services: [s] });
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.label === 'Other') return 1;
      if (b.label === 'Other') return -1;
      return a.label.localeCompare(b.label);
    });
  }, [serviceCategories, serviceOptions]);
  const isLoadingCategoryCapabilities = isLoadingServices || isLoadingCategories;

  // watch role to toggle specialties UI
  const isSalesRep = currentRole === "salesRep";
  const isEditorRole = currentRole === "editor";
  const isSalesRepViewer = viewerRole === 'salesRep';
  const roleSelectionDisabled = isSalesRepViewer && Boolean(initialData);
  const canManageRoles = viewerRole === 'admin' || viewerRole === 'superadmin';
  const canCreateSalesRep = viewerRole === 'superadmin';
  // Allow superadmin to edit "Created by" for admin, salesRep, client, and superadmin accounts
  // Also allow when creating new accounts (initialData is null)
  const canEditCreatedBy = viewerRole === 'superadmin' && (
    !initialData || // Creating new account
    (initialData && (
      initialData.role === 'admin' || 
      initialData.role === 'salesRep' || 
      initialData.role === 'client' || 
      initialData.role === 'superadmin'
    ))
  );
  const canEditClientRep = isClientRole && canAssignClientRep && (viewerRole === 'superadmin' || !repAssigned);
  const showRepSelector = isClientRole ? canEditClientRep : canEditCreatedBy;
  const repLabel = isClientRole ? 'Account Rep' : 'Created by';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.5rem)] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-auto sm:max-h-[90vh] sm:w-full sm:gap-4 sm:rounded-lg sm:px-6 sm:py-8">
        <Form {...form}>
        <DialogHeader className="relative border-b px-3 py-2.5 sm:-mt-2 sm:border-0 sm:px-0 sm:pt-0 sm:pb-0 sm:pr-14">
          {/* Row 1: Title left + Role right */}
          <div className="flex w-full items-center justify-between gap-3 pr-8 sm:pr-0">
            <DialogTitle className="min-w-0 truncate pt-0 text-[15px] font-semibold sm:text-xl sm:truncate-none">
              {initialData
                ? "Update account"
                : "New account"}
              <span className="hidden sm:inline">
                {initialData ? " details" : " — create user"}
              </span>
            </DialogTitle>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="flex-shrink-0">
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={roleSelectionDisabled}
                  >
                    <FormControl>
                      <SelectTrigger disabled={roleSelectionDisabled} className="h-7 w-auto gap-1 rounded-full border-border/60 bg-muted/40 px-2.5 text-xs font-medium sm:h-9 sm:w-[140px] sm:rounded-md sm:px-3 sm:text-sm">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isSalesRepViewer ? (
                        <SelectItem value="client">Client</SelectItem>
                      ) : (
                        <>
                          {viewerRole === 'superadmin' && (
                            <SelectItem value="superadmin" disabled={!canManageRoles}>
                              Super Admin
                            </SelectItem>
                          )}
                          <SelectItem value="admin" disabled={!canManageRoles}>
                            Admin
                          </SelectItem>
                          <SelectItem value="editing_manager" disabled={!canManageRoles}>
                            Editing Manager
                          </SelectItem>
                          <SelectItem value="photographer" disabled={!canManageRoles}>
                            Photographer
                          </SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="editor" disabled={!canManageRoles}>
                            Editor
                          </SelectItem>
                          <SelectItem value="salesRep" disabled={!canCreateSalesRep}>
                            Sales/Rep
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {isSalesRepViewer && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-right whitespace-nowrap sm:text-xs sm:mt-1">
                      {initialData
                        ? 'Sales reps can edit only client accounts they manage.'
                        : 'Sales reps can only create client accounts.'}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {/* Row 2: Rep selector / label */}
          {showRepSelector && (
            <FormField
              control={form.control}
              name="created_by_id"
              render={({ field }) => (
                <FormItem className="mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground sm:text-xs">{repLabel}:</span>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        const selected = adminsAndReps.find(u => u.id === value);
                        if (selected) {
                          form.setValue('created_by_name', selected.name);
                        }
                      }}
                      value={field.value || (currentUser?.id ? String(currentUser.id) : "")}
                    >
                      <FormControl>
                        <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 gap-1 text-[11px] font-medium text-foreground hover:bg-transparent focus:ring-0 focus:ring-offset-0 w-auto sm:text-xs">
                          <SelectValue placeholder={`Select ${repLabel.toLowerCase()}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {adminsAndReps.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {!showRepSelector && isClientRole && (
            <div className="text-[11px] text-muted-foreground mt-0.5 sm:text-xs">
              {repLabel}: <span className="font-medium text-foreground">
                {displayedRepName || 'Unassigned'}
              </span>
            </div>
          )}
        </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-0 sm:py-2">
              <div className="space-y-3 sm:space-y-8">
            <div className="grid gap-4 md:grid-cols-[260px,1fr]">
              <div className="flex flex-row items-center gap-3 sm:flex-col sm:gap-3">
                <ImageUpload
                  initialImage={avatarUrl}
                  onChange={(url) => {
                    setAvatarUrl(url);
                    form.setValue("avatar", url);
                  }}
                  className="h-16 w-16 sm:h-24 sm:w-24"
                />
                <div className="flex flex-col gap-1.5 sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs sm:h-9 sm:gap-2 sm:text-sm"
                    onClick={() => setAvatarPickerOpen(true)}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Selected avatar" className="h-4 w-4 rounded-full object-cover sm:h-5 sm:w-5" />
                    ) : (
                      <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                    Choose Avatar
                  </Button>
                  <Drawer open={avatarPickerOpen} onOpenChange={setAvatarPickerOpen}>
                    <DrawerContent className="max-h-[70dvh]">
                      <DrawerHeader className="pb-2">
                        <DrawerTitle>Choose Avatar</DrawerTitle>
                        <p className="text-sm text-muted-foreground">
                          Upload a profile image or choose a default avatar
                        </p>
                      </DrawerHeader>
                      <div className="overflow-y-auto px-4 pb-6">
                        <AvatarPicker
                          selectedAvatar={avatarUrl}
                          onSelect={(url) => {
                            setAvatarUrl(url);
                            form.setValue("avatar", url);
                            setAvatarPickerOpen(false);
                          }}
                        />
                      </div>
                    </DrawerContent>
                  </Drawer>
                </div>
              </div>
              <div className="space-y-2.5 sm:space-y-4">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="user@example.com" type="email" {...field} />
                        </FormControl>
                        {isClientRole && emailHelpState?.message && (
                          <div
                            className={cn(
                              "rounded-lg border p-3 text-sm",
                              emailHelpState.level === "error" && "border-rose-200 bg-rose-50 text-rose-800",
                              emailHelpState.level === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
                              emailHelpState.level === "info" && "border-sky-200 bg-sky-50 text-sky-800",
                            )}
                          >
                            <p>{emailHelpState.message}</p>
                            {emailHelpState.suggestedCorrection && !emailWarningOverride && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    form.setValue('email', emailHelpState.suggestedCorrection || '', {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    setEmailWarningOverride(false);
                                    setServerEmailHealth(undefined);
                                    form.clearErrors('email');
                                  }}
                                >
                                  Use suggested email
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEmailWarningOverride(true);
                                    form.clearErrors('email');
                                  }}
                                >
                                  Keep anyway
                                </Button>
                              </div>
                            )}
                            {emailWarningOverride && (
                              <p className="mt-2 text-xs font-medium">
                                Warning override enabled. This email will save with a delivery-risk warning.
                              </p>
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License number</FormLabel>
                    <FormControl>
                      <Input placeholder="LI0123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!isSalesRep && (
                <>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATE_OPTIONS.map((state) => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zipcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Zip Code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            {currentRole === "photographer" && !isSalesRep && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Insurance & Pilot License</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload insurance documents and pilot license
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="insuranceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter insurance number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="insuranceFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Document</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              placeholder="No file uploaded"
                              value={form.watch("insuranceFileName") || ""}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setInsuranceModalOpen(true)}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {form.watch("insuranceFile") ? "Change" : "Upload"}
                            </Button>
                            {form.watch("insuranceFile") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  form.setValue("insuranceFile", "");
                                  form.setValue("insuranceFileName", "");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pilotLicenseFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pilot License</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              placeholder="No file uploaded"
                              value={form.watch("pilotLicenseFileName") || ""}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPilotLicenseModalOpen(true)}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {form.watch("pilotLicenseFile") ? "Change" : "Upload"}
                            </Button>
                            {form.watch("pilotLicenseFile") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  form.setValue("pilotLicenseFile", "");
                                  form.setValue("pilotLicenseFileName", "");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {isSalesRep && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Rep Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure payout, coverage, and communication preferences for this rep.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="repPayoutEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payout Email</FormLabel>
                        <FormControl>
                          <Input placeholder="payouts@rep.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repPayoutFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payout Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select schedule" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {payoutFrequencyOptions.map((freq) => (
                              <SelectItem key={freq} value={freq}>
                                {freq === 'weekly' && 'Weekly (Sunday recap)'}
                                {freq === 'biweekly' && 'Bi-weekly'}
                                {freq === 'monthly' && 'Monthly'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                  <FormField
                    control={form.control}
                    name="repHomeStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Home Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Street address"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeStreet2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apartment / Suite</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Unit or suite"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="City"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || ''}
                            onValueChange={field.onChange}
                            disabled={!canEditSensitiveRepFields}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATE_OPTIONS.map((state) => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repHomeZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Zip / Postal code"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repCommissionRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commission %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="10"
                            {...field}
                            disabled={!canEditSensitiveRepFields}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Only super admins can adjust commission percentages.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="repSalesCategories"
                  render={({ field }) => {
                    const valueArray: string[] = Array.isArray(field.value) ? field.value : [];
                    const toggle = (opt: string) => {
                      if (valueArray.includes(opt)) field.onChange(valueArray.filter((v) => v !== opt));
                      else field.onChange([...valueArray, opt]);
                    };

                    return (
                      <FormItem>
                        <FormLabel>Eligible Sales Categories</FormLabel>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {repCategoryOptions.map((opt) => {
                            const active = valueArray.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggle(opt)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-sm border transition",
                                  active
                                    ? "bg-[#6E59A5] text-white border-[#6E59A5] shadow-sm"
                                    : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-400/60 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                                )}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="repAutoApprovePayouts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3">
                        <div className="space-y-0.5">
                          <FormLabel>Auto-approve payouts</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Send weekly payout reports and auto-approve when enabled.
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="repCanTextClients"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border px-4 py-3">
                        <div className="space-y-0.5">
                          <FormLabel>Allow SMS outreach</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Enable this rep to send text messages from the dashboard.
                          </p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="repNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional comp notes or special handling for this rep"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentRole === "photographer" && (
              <>
                <FormField
                  control={form.control}
                  name="specialties"
                  render={({ field }) => {
                    const valueArray: string[] = Array.isArray(field.value) ? field.value : [];
                    const toggle = (categoryId: string, serviceIds: string[]) => {
                      const selected = valueArray.includes(categoryId) || serviceIds.some((id) => valueArray.includes(id));
                      const categoryServiceIds = new Set(serviceIds);

                      if (selected) {
                        field.onChange(valueArray.filter((value) => value !== categoryId && !categoryServiceIds.has(value)));
                        return;
                      }

                      field.onChange([
                        ...valueArray.filter((value) => !categoryServiceIds.has(value)),
                        categoryId,
                      ]);
                    };

                    return (
                      <FormItem>
                        <FormLabel>Service Capabilities</FormLabel>
                        <p className="text-xs text-muted-foreground mb-2">
                          Select categories this photographer can shoot
                        </p>
                        {isLoadingCategoryCapabilities ? (
                          <div className="flex items-center gap-2 py-4 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading categories...</span>
                          </div>
                        ) : categoryCapabilityOptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">
                            No categories configured. Add services in Scheduling Settings.
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {categoryCapabilityOptions.map((category) => {
                              const serviceIds = category.services.map((service) => service.id);
                              const active = valueArray.includes(category.id) || serviceIds.some((id) => valueArray.includes(id));

                              return (
                                <button
                                  key={category.id}
                                  type="button"
                                  onClick={() => toggle(category.id, serviceIds)}
                                  title={`${category.services.length} services`}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-sm border transition",
                                    active
                                      ? "bg-primary/10 text-primary border-primary/30 shadow-sm"
                                      : "bg-background text-muted-foreground border-border/70 hover:bg-muted/60 hover:text-foreground"
                                  )}
                                >
                                  {category.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Travel Range */}
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Travel Range</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="travelRange"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs text-muted-foreground">Max Distance</FormLabel>
                          <span className="text-sm font-semibold">{field.value || 25} {form.watch('travelRangeUnit') || 'miles'}</span>
                        </div>
                        <FormControl>
                          <Slider
                            value={[field.value || 25]}
                            onValueChange={([val]) => field.onChange(val)}
                            min={5}
                            max={150}
                            step={5}
                            className="mt-2"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="travelRangeUnit"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2">
                          {(['miles', 'km'] as const).map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              onClick={() => field.onChange(unit)}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs border transition",
                                field.value === unit
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-background text-muted-foreground border-border/70 hover:bg-muted/60"
                              )}
                            >
                              {unit === 'miles' ? 'Miles' : 'Kilometers'}
                            </button>
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Equipments</h3>
                    </div>
                    {!initialData && (
                      <Button type="button" variant="outline" size="sm" onClick={addEquipmentRow}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Equipment
                      </Button>
                    )}
                  </div>

                  {initialData ? (
                    <p className="text-sm text-muted-foreground">
                      Assigned equipments are managed from Admin Accounting.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2 rounded-md border border-border/70 bg-background p-3">
                        <div className="space-y-1">
                          <FormLabel>Assign Existing Unassigned Equipment</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Pick company equipment that was already added in Accounting Equipments.
                          </p>
                        </div>
                        {existingEquipmentOptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No unassigned equipment available.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {existingEquipmentOptions.map((equipment) => {
                              const id = String(equipment.id);
                              const active = selectedExistingEquipmentIds.includes(id);
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setSelectedExistingEquipmentIds((ids) =>
                                    active ? ids.filter((value) => value !== id) : [...ids, id]
                                  )}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-sm transition",
                                    active
                                      ? "border-primary/40 bg-primary/10 text-primary"
                                      : "border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                  )}
                                >
                                  {equipment.name}{equipment.serial_number ? ` · ${equipment.serial_number}` : ""}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {equipmentRows.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border/70 bg-background px-3 py-4 text-sm text-muted-foreground">
                          No manual equipment rows added.
                        </div>
                      ) : equipmentRows.map((row, index) => (
                        <div key={row.id} className="rounded-md border border-border/70 bg-background p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">Equipment {index + 1}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeEquipmentRow(row.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                              <FormLabel>Name</FormLabel>
                              <Input
                                value={row.name}
                                onChange={(event) => updateEquipmentRow(row.id, { name: event.target.value })}
                                placeholder="Camera, iGUIDE machine"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <FormLabel>Serial Number</FormLabel>
                              <Input
                                value={row.serialNumber}
                                onChange={(event) => updateEquipmentRow(row.id, { serialNumber: event.target.value })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <FormLabel>Issue Date</FormLabel>
                              <Input
                                type="date"
                                value={row.issueDate}
                                onChange={(event) => updateEquipmentRow(row.id, { issueDate: event.target.value })}
                              />
                            </div>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <FormLabel>Admin Reference Photos</FormLabel>
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(event) => updateEquipmentRow(row.id, {
                                photos: Array.from(event.target.files || []),
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Optional photos uploaded by admin now; more can be added later from Admin Accounting Equipments.
                            </p>
                            {row.photos.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {row.photos.length} photo{row.photos.length === 1 ? "" : "s"} selected
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {isEditorRole && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Editing Capabilities</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose which editing lanes this account can automatically receive.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="editingCapabilities"
                  render={({ field }) => {
                    const valueArray: string[] = Array.isArray(field.value) ? field.value : []
                    const toggle = (capability: string) => {
                      if (valueArray.includes(capability)) {
                        field.onChange(valueArray.filter((value) => value !== capability))
                        return
                      }

                      field.onChange([...valueArray, capability])
                    }

                    return (
                      <FormItem>
                        <FormLabel>Lane Assignment</FormLabel>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {editorCapabilityOptions.map((option) => {
                            const active = valueArray.includes(option.id)
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => toggle(option.id)}
                                className={cn(
                                  "rounded-lg border px-4 py-3 text-left transition",
                                  active
                                    ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                              >
                                <div className="text-sm font-medium">{option.label}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {option.description}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Select one or both. Mixed photo/video shoots route lanes based on these capabilities.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </div>
            )}

            {isClientRole && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Client Booking Defaults</h3>
                  <p className="text-sm text-muted-foreground">
                    Save extra recipients for shoot emails and a default discount for future bookings.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="shootCcEmailsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shoot Email CCs</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={"one@email.com\nteam@email.com"}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Add one email per line. These recipients will be copied on shoot and payment emails.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="clientDiscountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Discount Type</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || 'none'}
                            onValueChange={(value) => {
                              const nextValue = value === 'none' ? undefined : value;
                              field.onChange(nextValue);
                              if (!nextValue) {
                                form.setValue('clientDiscountValue', '');
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="No discount" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No discount</SelectItem>
                              <SelectItem value="fixed">Dollar Amount</SelectItem>
                              <SelectItem value="percent">Percentage</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientDiscountValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Default Discount Value {form.watch('clientDiscountType') === 'percent' ? '(%)' : '($)'}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={form.watch('clientDiscountType') === 'percent' ? '100' : undefined}
                            placeholder={form.watch('clientDiscountType') === 'percent' ? '10' : '25'}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="serviceGroupIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Groups</FormLabel>
                      <FormControl>
                        <MultiSelectChecklist
                          options={serviceGroupOptions}
                          value={field.value || []}
                          onChange={field.onChange}
                          placeholder="Leave empty to let this client see the full service catalog."
                          emptyMessage="No service groups available yet."
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Choose which services this client can book by default.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="companyNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any internal notes about this user or their company"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
              </div>
            </div>

            {/* Pilot License Upload Modal */}
            {currentRole === "photographer" && (
              <FileUploadModal
                open={pilotLicenseModalOpen}
                onOpenChange={setPilotLicenseModalOpen}
                onUploadComplete={(url, fileName) => {
                  form.setValue("pilotLicenseFile", url);
                  form.setValue("pilotLicenseFileName", fileName || "Pilot License");
                }}
                title="Upload Pilot License"
                folder="pilot-licenses"
                accept="image/*,.pdf"
                initialValue={form.watch("pilotLicenseFile")}
                initialFileName={form.watch("pilotLicenseFileName")}
                showFileNameInput={true}
                fileNameLabel="License Number/Name"
              />
            )}

            {/* Insurance Upload Modal */}
            {currentRole === "photographer" && !isSalesRep && (
              <FileUploadModal
                open={insuranceModalOpen}
                onOpenChange={setInsuranceModalOpen}
                onUploadComplete={(url, fileName) => {
                  form.setValue("insuranceFile", url);
                  form.setValue("insuranceFileName", fileName || "Insurance Document");
                }}
                title="Upload Insurance Document"
                folder="insurance"
                accept="image/*,.pdf"
                initialValue={form.watch("insuranceFile")}
                initialFileName={form.watch("insuranceFileName")}
                showFileNameInput={true}
                fileNameLabel="Document Name"
              />
            )}

            <DialogFooter className="flex-row gap-2 border-t bg-background px-3 py-2.5 sm:justify-end sm:gap-0 sm:space-x-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] sm:[padding-bottom:0]">
              <Button type="button" variant="outline" className="flex-1 sm:flex-initial sm:w-auto" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-initial sm:w-auto"
                onClick={() => {
                  console.log("✅ Create Account button clicked");
                  form.handleSubmit(handleSubmit)();
                }}
              >
                {initialData ? "Update Account" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
