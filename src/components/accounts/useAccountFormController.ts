import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';
import type { EmailHealth, RepDetails } from '@/types/auth';
import { useServices } from '@/hooks/useServices';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { useServiceGroups } from '@/hooks/useServiceGroups';
import { usePermission } from '@/hooks/usePermission';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useQueryClient } from '@tanstack/react-query';
import { analyzeEmailInput, normalizeEmailHealth } from '@/utils/emailHealth';
import { getCategorySpecialtyId } from '@/utils/photographerSpecialties';
import { createAdminPhotographerEquipment, updateAdminPhotographerEquipment } from '@/services/photographerEquipmentService';
import { useAccountEquipment } from './useAccountEquipment';
import {
  SALES_REP_CREATABLE_ROLE,
  asRecord,
  createAccountFormSchema,
  editorCapabilityOptions,
  getRequestErrorMessage,
  parseShootCcEmails,
  type AccountFormProps,
  type AccountFormValues,
  type FormRole,
} from './accountFormModel';
import { applyPhotographerAccountPayload } from './photographerAccountPayload';

export function useAccountFormController({
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
  const [serverEmailHealth, setServerEmailHealth] = useState<EmailHealth | undefined>(
    normalizeEmailHealth(initialData?.email_health),
  );
  const hasAutoSelectedDefaultServiceGroupRef = React.useRef(false);
  const { toast } = useToast();
  const { role: viewerRole, user: currentUser } = useAuth();
  const useDesktopAvatarPicker = useMediaQuery("(min-width: 768px)");
  const permission = usePermission();
  const clientsPermission = permission.forResource('clients');
  const canEditSensitiveRepFields = viewerRole === 'superadmin';
  const queryClient = useQueryClient();
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(createAccountFormSchema(viewerRole, Boolean(initialData))),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "client" as FormRole,
      timezone: "",
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
          // 5x is the product default until a photographer states otherwise.
          defaultBracketMode: 5 as const,
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
  const currentRole = form.watch("role");
  const {
    equipmentRows,
    setEquipmentRows,
    existingEquipmentOptions,
    assignedEquipmentOptions,
    setAssignedEquipmentOptions,
    assignedEquipmentLoading,
    assignedEquipmentError,
    setAssignedEquipmentError,
    selectedExistingEquipmentIds,
    setSelectedExistingEquipmentIds,
    equipmentManageOpen,
    setEquipmentManageOpen,
    equipmentSaving,
    editingEquipmentId,
    setEditingEquipmentId,
    equipmentEditValues,
    setEquipmentEditValues,
    updateEquipmentRow,
    addEquipmentRow,
    removeEquipmentRow,
    activeEquipmentRows,
    handleSaveAccountEquipment,
    openEquipmentEdit,
    saveEquipmentEdit,
  } = useAccountEquipment({
    initialDataId: initialData?.id,
    currentRole,
    open,
    toast,
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
        const repMetadata = asRecord(initialData.metadata);
        const repMetaId = repMetadata.accountRepId || repMetadata.account_rep_id || repMetadata.repId || repMetadata.rep_id;
        const repMetaName = repMetadata.accountRep || repMetadata.account_rep || repMetadata.rep;
        const rawCreatedById = initialData.created_by_id || repMetaId || "";
        const createdById = rawCreatedById ? String(rawCreatedById) : "";
        const createdByName = initialData.created_by_name || initialData.createdBy || String(repMetaName || "");
        form.reset({
          firstName,
          lastName,
          email: initialData.email,
          role,
          timezone: initialData.timezone || "",
          phone: initialData.phone || "",
          address: initialData.address || "",
          city: initialData.city || "",
          state: initialData.state || "",
          zipcode: initialData.zipcode || "",
          company: initialData.company || "",
          licenseNumber: initialData.licenseNumber || initialData.license_number || "",
          shootCcEmailsText: Array.isArray(initialData.shootCcEmails ?? initialData.shoot_cc_emails)
            ? (initialData.shootCcEmails ?? initialData.shoot_cc_emails ?? []).join('\n')
            : "",
          clientDiscountType: (initialData.clientDiscountType ?? initialData.client_discount_type ?? undefined) || undefined,
          clientDiscountValue: (initialData.clientDiscountValue ?? initialData.client_discount_value) !== undefined
            && (initialData.clientDiscountValue ?? initialData.client_discount_value) !== null
            ? String(initialData.clientDiscountValue ?? initialData.client_discount_value)
            : "",
          avatar: initialData.avatar || "",
          companyNotes: initialData.companyNotes || "",
          isActive: initialData.isActive !== undefined ? initialData.isActive : true,
          specialties: (initialData.metadata?.specialties as string[]) ?? initialData.specialties ?? [],
          editingCapabilities: (initialData.metadata?.editing_capabilities as string[])
            ?? initialData.editingCapabilities
            ?? (role === 'editor' ? ['photo', 'video'] : []),
          travelRange: Number(initialData.metadata?.travel_range) || 25,
          travelRangeUnit: (initialData.metadata?.travel_range_unit as 'miles' | 'km') || 'miles',
          // A real column rather than metadata: the bracket resolver reads it directly.
          // 5x is the product default when the photographer has stated no preference.
          defaultBracketMode: Number(
            (initialData as { default_bracket_mode?: number | null }).default_bracket_mode ?? 5,
          ) === 3 ? 3 : 5,
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
          serviceGroupIds: Array.isArray(initialData.service_group_ids)
            ? initialData.service_group_ids.map((id) => String(id))
            : Array.isArray(initialData.service_groups)
              ? initialData.service_groups.map((group) => String(group.id))
              : [],
        });
        setAvatarUrl(initialData.avatar || "");
        setEquipmentRows([]);
        setAssignedEquipmentOptions([]);
        setAssignedEquipmentError(null);
        setSelectedExistingEquipmentIds([]);
        setEquipmentManageOpen(false);
        setEditingEquipmentId(null);
      } else {
        hasAutoSelectedDefaultServiceGroupRef.current = false;
        form.reset({
          firstName: "",
          lastName: "",
          email: "",
          role: "client",
          timezone: "",
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
          // 5x is the product default until a photographer states otherwise.
          defaultBracketMode: 5 as const,
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
        setAssignedEquipmentOptions([]);
        setAssignedEquipmentError(null);
        setSelectedExistingEquipmentIds([]);
        setEquipmentManageOpen(false);
        setEditingEquipmentId(null);
      }
    }
  }, [
    currentUser?.id, currentUser?.name, form, initialData, open,
    setAssignedEquipmentError, setAssignedEquipmentOptions, setEditingEquipmentId,
    setEquipmentManageOpen, setEquipmentRows, setSelectedExistingEquipmentIds, viewerRole,
  ]);
  const repMetadata = asRecord(initialData?.metadata);
  const repMetaId = repMetadata.accountRepId || repMetadata.account_rep_id || repMetadata.repId || repMetadata.rep_id;
  const repMetaName = repMetadata.accountRep || repMetadata.account_rep || repMetadata.rep;
  const createdById = initialData?.created_by_id || repMetaId || "";
  const createdByName = initialData?.created_by_name || initialData?.createdBy || String(repMetaName || "");
  const formCreatedById = form.watch("created_by_id");
  const formCreatedByName = form.watch("created_by_name");
  const currentEmail = form.watch("email");
  const isClientRole = currentRole === "client";
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
    const serverEmailStatus = serverEmailHealth?.status;
    const shouldShowServerEmailHealth = Boolean(
      serverEmailHealth?.warning_message ||
      serverEmailHealth?.suggested_correction ||
      serverEmailHealth?.requires_confirmation ||
      serverEmailStatus === 'bounced' ||
      serverEmailStatus === 'invalid'
    );
    if (shouldShowServerEmailHealth) {
      return {
        level: serverEmailStatus === 'bounced' || serverEmailStatus === 'invalid' ? 'error' : 'info',
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
  }, [form, initialData, open, viewerRole]);
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
  useEffect(() => {
    if (!open || initialData || currentRole !== 'client' || hasAutoSelectedDefaultServiceGroupRef.current) {
      return;
    }
    const defaultServiceGroup = serviceGroups.find((group) => group.is_default);
    if (!defaultServiceGroup) {
      return;
    }
    hasAutoSelectedDefaultServiceGroupRef.current = true;
    if ((form.getValues('serviceGroupIds') || []).length === 0) {
      form.setValue('serviceGroupIds', [defaultServiceGroup.id], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [currentRole, form, initialData, open, serviceGroups]);
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
            const data: unknown = await res.json();
            const users = Array.isArray(asRecord(data).users) ? asRecord(data).users as unknown[] : [];
            const filtered = users
              .map(asRecord)
              .filter((user) => user.role === 'admin' || user.role === 'salesRep' || user.role === 'superadmin')
              .map((user) => ({ id: String(user.id), name: String(user.name || user.email || '') }));
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
    const normalizedDiscountValue = values.role === 'client' && String(values.clientDiscountValue ?? '').trim()
      ? Number(values.clientDiscountValue)
      : null;
    const normalizedEditingCapabilities = values.role === 'editor'
      ? editorCapabilityOptions
          .map((option) => option.id)
          .filter((capability) => Array.isArray(values.editingCapabilities) && values.editingCapabilities.includes(capability))
      : [];
    // `default_bracket_mode` is a real user column rather than a form field name, so the
    // payload carries it alongside the camelCase form values.
    const payload: AccountFormValues & { default_bracket_mode?: 3 | 5 } = {
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
    const canAssignRepForPayload = canEditCreatedBy || (canAssignClientRep && values.role === 'client');
    if (values.role === 'client' && canAssignRepForPayload) {
      if (values.created_by_id) {
        metadataPayload.accountRepId = String(values.created_by_id);
        metadataPayload.account_rep_id = Number.isNaN(Number(values.created_by_id))
          ? values.created_by_id
          : Number(values.created_by_id);
      }
      if (values.created_by_name) {
        metadataPayload.accountRep = values.created_by_name;
        metadataPayload.account_rep = values.created_by_name;
      }
    }
    if (values.role === 'photographer') {
      applyPhotographerAccountPayload(values, metadataPayload, payload);
    }
    if (Object.keys(metadataPayload).length) {
      payload.metadata = metadataPayload;
    }
    const shouldSendEmailOverride = values.role === 'client' && emailWarningOverride;
    if (initialData && canAssignRepForPayload) {
      if (values.created_by_name) {
        payload.created_by_name = values.created_by_name;
      }
      if (values.created_by_id) {
        payload.created_by_id = values.created_by_id;
      }
    }
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
        if (values.timezone) formData.append('timezone', values.timezone);
        if (values.bio) formData.append('bio', values.bio);
        if (avatarUrl && !avatarUrl.startsWith('blob:')) {
          formData.append('avatar', avatarUrl);
        }
        if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
          formData.append('specialties', JSON.stringify(values.specialties));
        }
        if (values.role === 'photographer' && values.defaultBracketMode) {
          formData.append('default_bracket_mode', String(values.defaultBracketMode));
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
          phone: updated.phone ?? updated.phonenumber ?? updated.phone_number,
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
        });
        toast({ title: 'User updated', description: `${updated.name} updated successfully.` });
        if (values.role === 'client') {
          queryClient.invalidateQueries({ queryKey: ['service-groups'] });
        }
        onOpenChange(false);
      } catch (e: unknown) {
        console.error('Update account failed', e);
        toast({ title: 'Update failed', description: getRequestErrorMessage(e, 'Unable to update user'), variant: 'destructive' });
      } finally {
        setSubmitting(false);
      }
      return;
    }
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
      if (values.timezone) formData.append('timezone', values.timezone);
      if (values.bio) formData.append('bio', values.bio);
        if (values.specialties && Array.isArray(values.specialties) && values.specialties.length > 0) {
          formData.append('specialties', JSON.stringify(values.specialties));
        }
      if (values.role === 'photographer' && values.defaultBracketMode) {
        formData.append('default_bracket_mode', String(values.defaultBracketMode));
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
      if (canAssignRepForPayload && values.created_by_id && values.created_by_name) {
        formData.append('created_by_name', values.created_by_name);
        formData.append('created_by_id', String(values.created_by_id));
      } else if (currentUser) {
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
      const notificationDelivery = json.notification_delivery;
      setServerEmailHealth(normalizeEmailHealth(created?.email_health));
      onSubmit({
        ...values,
        name: created.name,
        firstName: values.firstName,
        lastName: values.lastName,
        email: created.email,
        role: created.role,
        phone: created.phone ?? created.phonenumber ?? created.phone_number,
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
      });
      const failedNotifications = [
        notificationDelivery?.email?.account_created,
        notificationDelivery?.email?.verification,
        notificationDelivery?.email?.equipment,
        notificationDelivery?.sms,
      ].filter((channel) => channel?.attempted && !channel?.sent);
      toast({
        title: failedNotifications.length > 0 ? 'User created — notification issue' : 'User created',
        description: failedNotifications.length > 0
          ? `${created.name} was added, but ${failedNotifications.length} notification channel${failedNotifications.length === 1 ? '' : 's'} failed. Check Messaging logs before considering onboarding complete.`
          : `${created.name} added successfully. Email and SMS delivery were accepted.`,
        variant: failedNotifications.length > 0 ? 'destructive' : 'default',
      });
      if (values.role === 'client') {
        queryClient.invalidateQueries({ queryKey: ['service-groups'] });
      }
      onOpenChange(false);
    } catch (e: unknown) {
      console.error('Create account failed', e);
      toast({ title: 'Create failed', description: getRequestErrorMessage(e, 'Unable to create user'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };
  const { data: servicesData, isLoading: isLoadingServices } = useServices();
  const { data: serviceCategoriesData, isLoading: isLoadingCategories } = useServiceCategories();
  const serviceOptions = React.useMemo(() => {
    if (!servicesData || servicesData.length === 0) return [];
    return servicesData.filter((s) => s.active !== false);
  }, [servicesData]);
  const serviceCategories = React.useMemo(() => {
    if (!Array.isArray(serviceCategoriesData)) return [];
    return serviceCategoriesData
      .map((value) => {
        const category = asRecord(value);
        return {
          id: String(category.id),
          name: String(category.name || '').trim(),
        };
      })
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
  const isSalesRep = currentRole === "salesRep";
  const isEditorRole = currentRole === "editor";
  const isSalesRepViewer = viewerRole === 'salesRep';
  const roleSelectionDisabled = isSalesRepViewer && Boolean(initialData);
  const canManageRoles = viewerRole === 'admin' || viewerRole === 'superadmin';
  const canCreateSalesRep = viewerRole === 'superadmin';
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

  return {
    open,
    onOpenChange,
    initialData,
    avatarUrl,
    setAvatarUrl,
    submitting,
    adminsAndReps,
    pilotLicenseModalOpen,
    setPilotLicenseModalOpen,
    insuranceModalOpen,
    setInsuranceModalOpen,
    avatarPickerOpen,
    setAvatarPickerOpen,
    emailWarningOverride,
    setEmailWarningOverride,
    equipmentRows,
    setEquipmentRows,
    existingEquipmentOptions,
    assignedEquipmentOptions,
    assignedEquipmentLoading,
    assignedEquipmentError,
    selectedExistingEquipmentIds,
    setSelectedExistingEquipmentIds,
    equipmentManageOpen,
    setEquipmentManageOpen,
    equipmentSaving,
    editingEquipmentId,
    setEditingEquipmentId,
    equipmentEditValues,
    setEquipmentEditValues,
    updateEquipmentRow,
    addEquipmentRow,
    removeEquipmentRow,
    handleSaveAccountEquipment,
    openEquipmentEdit,
    saveEquipmentEdit,
    serverEmailHealth,
    setServerEmailHealth,
    form,
    viewerRole,
    currentUser,
    currentRole,
    localEmailHint,
    emailHelpState,
    displayedRepId,
    displayedRepName,
    repAssigned,
    serviceGroupOptions,
    handleSubmit,
    serviceOptions,
    serviceCategories,
    categoryCapabilityOptions,
    isLoadingCategoryCapabilities,
    isSalesRep,
    isEditorRole,
    isClientRole,
    isSalesRepViewer,
    roleSelectionDisabled,
    canManageRoles,
    canCreateSalesRep,
    canEditSensitiveRepFields,
    canEditClientRep,
    showRepSelector,
    repLabel,
    useDesktopAvatarPicker,
  };
}

export type AccountFormController = ReturnType<typeof useAccountFormController>;
