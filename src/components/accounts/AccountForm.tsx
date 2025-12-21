import { useState, useEffect } from "react"; 
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
import { FileUploadModal } from "@/components/accounts/FileUploadModal";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/config/env";
import type { RepDetails } from "@/types/auth";
import { Upload, FileText, X } from "lucide-react";

// Define allowed roles for the form
type FormRole = 'admin' | 'photographer' | 'client' | 'editor' | 'salesRep';
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

const accountFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(['admin', 'photographer', 'client', 'editor', 'salesRep'] as const),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipcode: z.string().optional(),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
  avatar: z.string().optional(),
  companyNotes: z.string().optional(),
  bio: z.string().optional(),
  isActive: z.boolean().default(true),
  specialties: z.array(z.string()).optional(),
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
})
.superRefine((data, ctx) => {
  // License number required for clients
  if (data.role === "client" && !data.licenseNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "License number is required for clients",
      path: ["licenseNumber"],
    });
  }

  // City, State, Zip required for non-salesRep roles
  if (data.role !== "salesRep") {
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
});

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
  const { toast } = useToast();
  const { role: viewerRole, user: currentUser } = useAuth();
  const canEditSensitiveRepFields = viewerRole === 'superadmin';
  
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
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
      avatar: "",
          companyNotes: "",
          isActive: true,
          specialties: [],
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
          avatar: initialData.avatar || "",
          companyNotes: initialData.companyNotes || "",
          isActive: initialData.isActive !== undefined ? initialData.isActive : true,
          specialties: (initialData.metadata?.specialties as string[]) ?? (initialData as any).specialties ?? [],
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
          created_by_name: (initialData as any).created_by_name || (initialData as any).createdBy || "",
          created_by_id: (initialData as any).created_by_id || "",
        });
        setAvatarUrl(initialData.avatar || "");
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
          avatar: "",
          companyNotes: "",
          isActive: true,
          specialties: [],
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
        });
        setAvatarUrl("");
      }
    }
  }, [initialData, form, open]);

  // Fetch admins and reps for "Created by" dropdown (only for superadmin)
  useEffect(() => {
    const shouldFetch = viewerRole === 'superadmin' && open;
    
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
  }, [viewerRole, open]);

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
    const fullName = `${values.firstName} ${values.lastName}`.trim();
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
    }

    if (Object.keys(metadataPayload).length) {
      payload.metadata = metadataPayload;
    }

    // If editing, include created_by fields if superadmin is editing
    if (initialData && canEditCreatedBy) {
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
        formData.append('name', fullName || '');
        formData.append('email', values.email || '');
        if (values.phone) formData.append('phone_number', values.phone);
        if (values.company) formData.append('company_name', values.company);
        if (values.address) formData.append('address', values.address);
        if (values.city) formData.append('city', values.city);
        if (values.state) formData.append('state', values.state);
        if (values.zipcode) formData.append('zip', values.zipcode);
        formData.append('role', values.role || 'client');
        if (values.bio) formData.append('bio', values.bio);
        if (avatarUrl) formData.append('avatar', avatarUrl);
        if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
          formData.append('specialties', JSON.stringify(values.specialties));
        }
        if (values.pilotLicenseFile) formData.append('pilotLicenseFile', values.pilotLicenseFile);
        if (values.pilotLicenseFileName) formData.append('pilotLicenseFileName', values.pilotLicenseFileName);
        if (values.insuranceNumber) formData.append('insuranceNumber', values.insuranceNumber);
        if (values.insuranceFile) formData.append('insuranceFile', values.insuranceFile);
        if (values.insuranceFileName) formData.append('insuranceFileName', values.insuranceFileName);
        
        if (payload.metadata) {
          formData.append('metadata', JSON.stringify(payload.metadata));
        }

        if (canEditCreatedBy) {
          if (values.created_by_name) {
            formData.append('created_by_name', values.created_by_name);
          }
          if (values.created_by_id) {
            formData.append('created_by_id', String(values.created_by_id));
          }
        }

        const res = await fetch(`${API_BASE_URL}/api/admin/users/${initialData.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: formData,
        });

        if (!res.ok) {
          const errTxt = await res.text();
          throw new Error(errTxt || 'Failed to update user');
        }

        const json = await res.json();
        const updated = json.user;

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
        } as any);

        toast({ title: 'User updated', description: `${updated.name} updated successfully.` });
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

      const username =
        values.email?.split('@')[0] ||
        `${values.firstName}${values.lastName}`.replace(/\s+/g, '').toLowerCase();

      const formData = new FormData();
      formData.append('name', fullName || '');
      formData.append('email', values.email || '');
      formData.append('username', username);
      if (values.phone) formData.append('phone_number', values.phone);
      if (values.company) formData.append('company_name', values.company);
      if (values.address) formData.append('address', values.address);
      if (values.city) formData.append('city', values.city);
      if (values.state) formData.append('state', values.state);
      if (values.zipcode) formData.append('zip', values.zipcode);
      formData.append('role', values.role || 'client');
      if (values.bio) formData.append('bio', values.bio);
      if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
        formData.append('specialties', JSON.stringify(values.specialties));
      }
      if (values.pilotLicenseFile) formData.append('pilotLicenseFile', values.pilotLicenseFile);
      if (values.pilotLicenseFileName) formData.append('pilotLicenseFileName', values.pilotLicenseFileName);
      if (values.insuranceNumber) formData.append('insuranceNumber', values.insuranceNumber);
      if (values.insuranceFile) formData.append('insuranceFile', values.insuranceFile);
      if (values.insuranceFileName) formData.append('insuranceFileName', values.insuranceFileName);
      
      // Set created_by fields
      // If superadmin selected a creator, use that; otherwise use current user
      if (canEditCreatedBy && values.created_by_id && values.created_by_name) {
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

      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(errTxt || 'Failed to create user');
      }

      const json = await res.json();
      const created = json.user;

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
      } as any);

      toast({ title: 'User created', description: `${created.name} added successfully.` });
      onOpenChange(false);
    } catch (e: any) {
      console.error('Create account failed', e);
      toast({ title: 'Create failed', description: e?.message || 'Unable to create user', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // specialties options
  const specialtyOptions = [
    "Residential",
    "Commercial",
    "Aerial",
    "Virtual Tours",
    "Twilight",
    "HDR",
    "Drone",
    "3D Tours",
    "Flash Photos",
    "Walkthrough Video",
    "Vertical/Social media Video",
    "Matterport",
    "iGuide",
    "Elevated Photos",
    "Agent on Camera",
    "Floor plans",
    "HDR Photos + Video",
    "HDR Photos + Video + 3D Matterport",
    "HDR Photos + Video + iGuide",
    "Video + iGuide",
    "Video + Matterport",
    "Photos + Floor plans",
  ];

  // watch role to toggle specialties UI
  const currentRole = form.watch("role");
  const isSalesRep = currentRole === "salesRep";
  const roleSelectionDisabled = viewerRole === 'salesRep';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] lg:max-w-[1100px] max-h-[90vh] overflow-y-auto px-6 py-8">
        <Form {...form}>
        <DialogHeader className="relative -mt-2 pt-0 pr-14">
          <div className="flex items-start justify-between w-full gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="pt-0 text-xl font-semibold">
                {initialData
                  ? "Update user account details"
                  : "Create a new user account"}
              </DialogTitle>
              {canEditCreatedBy && (
                <FormField
                  control={form.control}
                  name="created_by_id"
                  render={({ field }) => (
                    <FormItem className="mt-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Created by:</span>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            const selected = adminsAndReps.find(u => u.id === value);
                            if (selected) {
                              form.setValue('created_by_name', selected.name);
                            }
                          }}
                          value={field.value || ((initialData as any)?.created_by_id ? String((initialData as any).created_by_id) : (currentUser?.id ? String(currentUser.id) : ""))}
                        >
                          <FormControl>
                            <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 gap-1 text-xs font-medium text-foreground hover:bg-transparent focus:ring-0 focus:ring-offset-0 w-auto">
                              <SelectValue placeholder="Select creator" />
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
              {!canEditCreatedBy && (initialData?.role === 'client' || (!initialData && currentRole === 'client')) && (
                <div className="text-xs text-muted-foreground mt-1">
                  Created by: <span className="font-medium text-foreground">
                    {(initialData as any)?.created_by_name || (initialData as any)?.createdBy || (!initialData && currentUser?.name ? currentUser.name : 'Unknown')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 pt-0 flex items-center gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel className="text-sm text-muted-foreground whitespace-nowrap">Role:</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={roleSelectionDisabled}
                      >
                        <FormControl>
                          <SelectTrigger disabled={roleSelectionDisabled} className="w-[140px] h-9">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin" disabled={!canManageRoles}>
                            Admin
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
                        </SelectContent>
                      </Select>
                    </div>
                    {roleSelectionDisabled && (
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-nowrap">
                        Sales reps can only create client accounts.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-[260px,1fr]">
              <div className="flex flex-col items-center gap-3">
                <ImageUpload
                  initialImage={avatarUrl}
                  onChange={(url) => {
                    setAvatarUrl(url);
                    form.setValue("avatar", url);
                  }}
                  className="h-24 w-24"
                />
                <p className="text-sm text-muted-foreground text-center">
                  Upload a profile image
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="user@example.com" type="email" {...field} />
                        </FormControl>
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
                          <Input placeholder="+1 (123) 456-7890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                          <Input placeholder="State" {...field} />
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
                <div className="grid gap-4 md:grid-cols-2">
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

                <div className="grid gap-4 md:grid-cols-2">
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

                <div className="grid gap-4 md:grid-cols-2">
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
                          <Input
                            placeholder="State"
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

                <div className="grid gap-4 md:grid-cols-2">
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
                    const toggle = (opt: string) => {
                      if (valueArray.includes(opt)) field.onChange(valueArray.filter((v) => v !== opt));
                      else field.onChange([...valueArray, opt]);
                    };

                    return (
                      <FormItem>
                        <FormLabel>Resources</FormLabel>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {specialtyOptions.map((opt) => {
                            const active = valueArray.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggle(opt)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-sm border transition",
                                  active
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                    : "bg-transparent text-slate-200 dark:text-slate-300 border-slate-700 hover:bg-slate-800/40"
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
              </>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
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
