import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import type { Client } from '@/types/clients';
import { useAuth } from '@/components/auth/AuthProvider';
import { format } from 'date-fns';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import type { InternalShootType } from '@/components/booking/ClientPropertyForm';
import type { ShootData } from '@/types/shoots';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWeatherData } from '@/hooks/useWeatherData';
import axios from 'axios';
import API_ROUTES from '@/lib/api';
import { API_BASE_URL } from '@/config/env';
import { isValidState, normalizeState } from '@/utils/stateUtils';
import { calculatePricingBreakdown, getTaxRateForState } from '@/utils/pricing';
import { normalizeEmailHealth } from '@/utils/emailHealth';
import { BOOK_ANOTHER_SHOOT_NAV_TARGET, clearBookingFormCache } from '@/utils/bookingDraftReset';
import { useBookShootWorkflow } from './useBookShootWorkflow';
import { useBookShootDuplicateWarnings } from './useBookShootDuplicateWarnings';
import { submitShootServiceMutation } from '@/utils/shootServiceMutation';
import { createComplimentaryReshoot } from '@/features/complimentary-reshoots/api';
import { useCompReshootBooking } from '@/features/complimentary-reshoots/useCompReshootBooking';
import { isComplimentaryReshootEnabled } from '@/features/complimentary-reshoots/featureFlag';
import type { ComplimentaryReshootCreatePayload } from '@/features/complimentary-reshoots/model';
import {
  buildAdminAdjustedPricing,
  asRecord,
  buildNormalizedAddress,
  getDateKey,
  getBookingWizardConfig,
  parseCurrencyInput,
  resolveSelectedServicePrice,
  roundCurrency,
  shouldWarnForLargeHomePhotoCount,
  toBackendTime,
  toDateInputValue,
  toTimeInputValue,
  type ServicePackage,
  type CompletedBookingSnapshot,
  type PropertyDraftSubmission,
} from './bookShootModel';
export const useBookShootController = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { formatDate } = useUserPreferences();
  const queryParams = new URLSearchParams(location.search);
  const clientIdFromUrl = queryParams.get('clientId');
  const clientNameFromUrl = queryParams.get('clientName');
  const clientCompanyFromUrl = queryParams.get('clientCompany');
  const editShootId = queryParams.get('edit'); // For modifying existing shoot requests
  const requestedCompReshootSourceId = queryParams.get('compReshootFrom');
  const additionalWorkSourceId = queryParams.get('reshootOf');
  const { user, isImpersonating } = useAuth();
  const canAdjustBookingAmount = !isImpersonating && ['admin', 'superadmin', 'super_admin'].includes(String(user?.role ?? '').toLowerCase());
  const compReshootSourceId = isComplimentaryReshootEnabled && canAdjustBookingAmount ? requestedCompReshootSourceId : null;
  const isCompReshootMode = Boolean(compReshootSourceId && !editShootId);
  const isClientAccount = Boolean(user && (user.role as string) === 'client');
  const roleCanCreateNoProductShoot = !isImpersonating && ['superadmin', 'editing_manager', 'admin', 'salesRep', 'salesrep', 'sales_rep', 'rep'].includes(String(user?.role ?? ''));
  const {
    isEditMode, setIsEditMode, editShootLoading, canRemoveAllServicesForEdit, packages, packagesLoading, setPackagesLoading,
    clients, setClients, client, setClient, address, setAddress, city, setCity, state,
    setState, zip, setZip, date, setDate, time, setTime, photographer, setPhotographer,
    servicePhotographers, setServicePhotographers, serviceSchedules, setServiceSchedules,
    selectedServices, setSelectedServices, shootType, setShootType, propertyDetails,
    setPropertyDetails, propertySqft, setPropertySqft, handleSelectedServicesChange,
    handleShootTypeChange, notes, setNotes, companyNotes, setCompanyNotes, photographerNotes,
    setPhotographerNotes, editorNotes, setEditorNotes, bypassPayment, setBypassPayment,
    sendNotification, setSendNotification, adjustedTotalInput, setAdjustedTotalInput, step,
    setStep, isComplete, setIsComplete, completedBooking, setCompletedBooking, isSubmitting,
    setIsSubmitting, duplicateLocationDialogOpen, setDuplicateLocationDialogOpen,
    createdShootId, setCreatedShootId, formErrors, setFormErrors, clientPropertyFormKey,
    setClientPropertyFormKey, toast, addShoot, shoots, navigate, photographers,
    setPhotographersList, availablePhotographerIds, setAvailablePhotographerIds,
    availabilityChecked, setAvailabilityChecked, to12Hour, fetchShoots, shouldCacheForm,
    CACHE_KEY, hasCachedData, setHasCachedData, clearBookingDraftState,
  } = useBookShootWorkflow({
    user, isClientAccount, clientIdFromUrl, clientNameFromUrl, clientCompanyFromUrl,
    editShootId, canAdjustBookingAmount,
  });
  const remountPropertyForm = React.useCallback(() => {
    setClientPropertyFormKey((current) => current + 1);
  }, [setClientPropertyFormKey]);
  const compReshoot = useCompReshootBooking({
    enabled: isCompReshootMode,
    sourceShootId: compReshootSourceId,
    selectedServices, photographerId: photographer, servicePhotographers, propertySqft,
    setClient,
    setAddress,
    setCity,
    setState,
    setZip,
    setPropertyDetails,
    setPropertySqft,
    setSelectedServices: handleSelectedServicesChange,
    setServicePhotographers,
    setServiceSchedules,
    setShootType,
    setBypassPayment,
    setAdjustedTotalInput,
    remountPropertyForm,
  });
  const compWizardSourceRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!isCompReshootMode || !compReshootSourceId) {
      compWizardSourceRef.current = null;
      return;
    }
    if (compWizardSourceRef.current !== compReshootSourceId) {
      compWizardSourceRef.current = compReshootSourceId;
      setStep(1);
    }
  }, [compReshootSourceId, isCompReshootMode, setStep]);
  const canCreateNoProductShoot = isEditMode
    ? canRemoveAllServicesForEdit
    : roleCanCreateNoProductShoot;
  const [positiveChargeDialogOpen, setPositiveChargeDialogOpen] = React.useState(false);
  const [exitCompDialogOpen, setExitCompDialogOpen] = React.useState(false);
  const {
    duplicateLocationWarningAcceptedRef, largeHomePackageWarningAcceptedRef, isFormComplete,
    sameDayAddressShoot, sameAddressScheduledDates, addressScheduledWarningMessage,
    sameDayAddressWarningMessage, duplicateLocationWarningShoot,
    duplicateLocationPopupMessage, showAddressScheduledWarning,
  } = useBookShootDuplicateWarnings({
    user, shoots, fetchShoots, formatDate, address, city, state, zip, date, time, step,
    editShootId, selectedServices, isClientAccount, client, canCreateNoProductShoot,
    to12Hour,
  });
  const selectedClientData = React.useMemo(() => {
    if (isClientAccount) {
      return user
        ? {
            ...user,
            id: String(user.id),
            shootCcEmails: user.shootCcEmails ?? user.shoot_cc_emails ?? [],
            shoot_cc_emails: user.shoot_cc_emails ?? user.shootCcEmails ?? [],
            clientDiscountType: user.clientDiscountType ?? user.client_discount_type ?? null,
            client_discount_type: user.client_discount_type ?? user.clientDiscountType ?? null,
            clientDiscountValue: user.clientDiscountValue ?? user.client_discount_value ?? null,
            client_discount_value: user.client_discount_value ?? user.clientDiscountValue ?? null,
          }
        : undefined;
    }
    return clients.find((clientRecord) => clientRecord.id === client);
  }, [client, clients, isClientAccount, user]);
  const selectedServiceSqft = propertySqft ?? propertyDetails?.sqft ?? propertyDetails?.livingArea ?? null;
  const serviceSubtotal = React.useMemo(() => {
    if (!selectedServices.length) {
      return 0;
    }
    return Math.round(
      selectedServices.reduce((sum, service) => sum + resolveSelectedServicePrice(service, selectedServiceSqft), 0) * 100
    ) / 100;
  }, [selectedServiceSqft, selectedServices]);
  const pricingBreakdown = React.useMemo(
    () =>
      calculatePricingBreakdown({
        serviceSubtotal,
        discountType: selectedClientData?.clientDiscountType ?? selectedClientData?.client_discount_type ?? null,
        discountValue: selectedClientData?.clientDiscountValue ?? selectedClientData?.client_discount_value ?? null,
        taxRate: getTaxRateForState(state),
      }),
    [selectedClientData, serviceSubtotal, state]
  );
  const parsedAdjustedTotal = React.useMemo(
    () => (canAdjustBookingAmount ? parseCurrencyInput(adjustedTotalInput) : null),
    [adjustedTotalInput, canAdjustBookingAmount]
  );
  const displayPricingBreakdown = React.useMemo(
    () => isCompReshootMode
      ? {
          ...pricingBreakdown,
          serviceSubtotal: 0,
          discountAmount: 0,
          discountedSubtotal: 0,
          taxAmount: 0,
          totalQuote: 0,
        }
      : buildAdminAdjustedPricing(pricingBreakdown, parsedAdjustedTotal, getTaxRateForState(state)),
    [isCompReshootMode, pricingBreakdown, parsedAdjustedTotal, state]
  );
  const getPackagePrice = () => serviceSubtotal;
  const getPhotographerRate = () => {
    return 0;
  };
  const getTax = () => displayPricingBreakdown.taxAmount;
  const getTotal = () => displayPricingBreakdown.totalQuote;
  const getAvailablePhotographers = () => {
    const role = user?.role;
    if (role === 'admin' || role === 'superadmin') return photographers;
    if (!date || !time) return [];
    if (availablePhotographerIds.length === 0) return [];
    return photographers.filter(p => availablePhotographerIds.includes(p.id));
  };
  useEffect(() => {
    if (!canAdjustBookingAmount && adjustedTotalInput) {
      setAdjustedTotalInput('');
    }
  }, [adjustedTotalInput, canAdjustBookingAmount, setAdjustedTotalInput]);
  const bookingWizard = getBookingWizardConfig(isCompReshootMode);
  const finalBookingStep = bookingWizard.finalStep;
  const schedulingStep = bookingWizard.schedulingStep;
  const validateCurrentStep = () => {
    if (isCompReshootMode && step === 1) {
      if (!compReshoot.reasonIsComplete) {
        toast({
          title: 'Choose a comp reason',
          description: 'Select why the return visit is needed before continuing.',
          variant: 'destructive',
        });
        return false;
      }
      return true;
    }
    if (isCompReshootMode && step === 2) {
      if (!client || !address || !city || !state || !zip || selectedServices.length === 0) {
        toast({
          title: 'Choose correction services',
          description: 'The source shoot must be loaded and at least one correction service selected.',
          variant: 'destructive',
        });
        return false;
      }
      if (!compReshoot.mappingIsComplete) {
        toast({
          title: 'Complete source service mapping',
          description: 'Link every selected service to the affected source item and responsibility.',
          variant: 'destructive',
        });
        return false;
      }
      return true;
    }
    if (!isCompReshootMode && step === 1) {
      if (!client && !isClientAccount) {
        toast({
          title: "Missing information",
          description: "Please select a client before proceeding.",
          variant: "destructive",
        });
        return false;
      }
      const requiresServices = isClientAccount || !canCreateNoProductShoot;
      if (!address || !city || !state || !zip || (requiresServices && selectedServices.length === 0)) {
        const onlyProductMissing = requiresServices && selectedServices.length === 0 &&
          !!address && !!city && !!state && !!zip;
        toast({
          title: onlyProductMissing ? "Product required" : "Missing information",
          description: onlyProductMissing
            ? "Add at least one product to schedule this shoot."
            : requiresServices
              ? "Please fill in all property details and select a package before proceeding."
              : "Please fill in all property details before proceeding.",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }
    if (step === schedulingStep) {
      const errors: Record<string, string> = {};
      if (!date) errors['date'] = "Please select a date";
      if (!time) errors['time'] = "Please select a time";
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return false;
      }
      const compIssue = isCompReshootMode ? compReshoot.scheduleValidationIssue : null;
      if (compIssue) {
        setFormErrors({ photographer: compIssue.description });
        toast({ ...compIssue, variant: 'destructive' });
        return false;
      }
      return true;
    }
    return true;
  };
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setFormErrors({});
    if (step === finalBookingStep) {
      setIsSubmitting(true);
      const clientValid = isClientAccount || !!client;
      const requiresServices = isCompReshootMode || isClientAccount || !canCreateNoProductShoot;
      if (!clientValid || !address || !city || !state || !zip || !date || !time || (requiresServices && selectedServices.length === 0)) {
        const onlyProductMissing = requiresServices && selectedServices.length === 0 &&
          clientValid && !!address && !!city && !!state && !!zip && !!date && !!time;
        toast({
          title: onlyProductMissing ? "Product required" : "Missing information",
          description: onlyProductMissing
            ? "Add at least one product to schedule this shoot."
            : requiresServices
              ? "Please fill in all required fields and select a service before confirming the booking."
              : "Please fill in all required fields before confirming the booking.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      const compSubmissionIssue = isCompReshootMode ? compReshoot.submissionValidationIssue : null;
      if (compSubmissionIssue) {
        toast({ ...compSubmissionIssue, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      const normalizedState = normalizeState(state);
      if (!normalizedState || !isValidState(normalizedState)) {
        toast({
          title: "Invalid State",
          description: "State must be a valid 2-letter abbreviation (e.g., CA, NY, DC). Please enter a valid state code.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      const hasAdjustedTotalInput = adjustedTotalInput.trim() !== '';
      const adjustedTotalQuote = canAdjustBookingAmount && hasAdjustedTotalInput
        ? parseCurrencyInput(adjustedTotalInput)
        : null;
      if (canAdjustBookingAmount && hasAdjustedTotalInput && adjustedTotalQuote === null) {
        toast({
          title: "Invalid amount",
          description: "Enter a valid booking amount before confirming.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      if (isCompReshootMode && adjustedTotalQuote !== null && adjustedTotalQuote > 0) {
        setPositiveChargeDialogOpen(true);
        setIsSubmitting(false);
        return;
      }
      if (!isCompReshootMode && duplicateLocationPopupMessage && !duplicateLocationWarningAcceptedRef.current) {
        setDuplicateLocationDialogOpen(true);
        setIsSubmitting(false);
        return;
      }
      const sqftForGuidance = propertySqft ?? propertyDetails?.sqft ?? propertyDetails?.livingArea ?? null;
      if (
        isClientAccount &&
        shouldWarnForLargeHomePhotoCount(selectedServices, sqftForGuidance) &&
        !largeHomePackageWarningAcceptedRef.current
      ) {
        largeHomePackageWarningAcceptedRef.current = true;
        toast({
          title: 'Consider more photo coverage',
          description: 'This home is 3,000+ sq ft. MLS Optimized delivery works best when the selected photo package covers all key rooms and exterior spaces.',
        });
        setIsSubmitting(false);
        return;
      }
      let time24Hour = '00:00:00';
      if (time) {
        const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const period = match[3].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          time24Hour = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        } else {
          const time24Match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
          if (time24Match) {
            const h = parseInt(time24Match[1], 10);
            const m = parseInt(time24Match[2], 10);
            const s = time24Match[3] || '00';
            time24Hour = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          }
        }
      }
      const shootDate = date ? new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        12
      ) : new Date();
      const pricingForSubmission = isCompReshootMode
        ? displayPricingBreakdown
        : buildAdminAdjustedPricing(
            pricingBreakdown,
            adjustedTotalQuote,
            getTaxRateForState(normalizedState)
          );
      const baseQuote = pricingForSubmission.discountedSubtotal;
      const photographerRate = getPackagePrice();
      const taxAmount = pricingForSubmission.taxAmount;
      const totalQuote = pricingForSubmission.totalQuote;
      const sqft = propertySqft ?? propertyDetails?.sqft ?? propertyDetails?.livingArea ?? null;
      const orderDate = date ? toDateInputValue(date) : shootDate.toISOString().split('T')[0];
      const orderTime = time24Hour || toBackendTime(time);
      const resolveServiceScheduledAt = (serviceId: string) => {
        const customSchedule = serviceSchedules[serviceId];
        const serviceDate = customSchedule?.date || orderDate;
        const serviceTime = toBackendTime(customSchedule?.time || orderTime || time);
        return serviceDate && serviceTime ? `${serviceDate} ${serviceTime}` : null;
      };
      const servicesPayload = selectedServices.map(service => {
        const assignedPhotographerId = servicePhotographers[service.id] || photographer || null;
        const compMapping = isCompReshootMode ? compReshoot.serviceMappings[service.id] : undefined;
        const mappedSourceService = isCompReshootMode ? compReshoot.getMappedSourceService(service.id) : undefined;
        const serviceCompensation = isCompReshootMode ? compReshoot.getServiceCompensation(service) : undefined;
        const nominalPrice = resolveSelectedServicePrice(service, sqft);
        const servicePayload: Record<string, unknown> = {
          id: service.id,
          photographer_id: assignedPhotographerId,
          scheduled_at: resolveServiceScheduledAt(service.id),
          is_deliverable: true,
        };

        // Existing-shoot prices and quantities are booked snapshots. Omitting
        // them lets the server preserve retained lines and price only genuinely
        // new services from the current catalogue/square-footage tier.
        if (!isEditMode) {
          servicePayload.price = isCompReshootMode ? 0 : nominalPrice;
          servicePayload.quantity = 1;
        }

        if (isCompReshootMode && compMapping && serviceCompensation) {
          servicePayload.nominal_price = nominalPrice;
          servicePayload.source_shoot_service_id = compMapping.sourceShootServiceId;
          servicePayload.responsibility = compMapping.responsibility;
          servicePayload.responsible_staff_id = compMapping.responsibility === 'photographer'
            ? mappedSourceService?.photographerId ?? null
            : null;
          servicePayload.photographer_compensation_mode = serviceCompensation.mode;
          if (serviceCompensation.mode === 'custom') {
            servicePayload.photographer_pay = serviceCompensation.amount;
          }
        }

        return servicePayload;
      });
      const serviceItemsPayload = servicesPayload.map(service => ({
        service_id: service.id,
        ...(service.price !== undefined ? { price: service.price } : {}),
        ...(service.quantity !== undefined ? { quantity: service.quantity } : {}),
        photographer_id: service.photographer_id,
        scheduled_at: service.scheduled_at,
        is_deliverable: true,
        ...(service.nominal_price !== undefined ? { nominal_price: service.nominal_price } : {}),
        ...(service.source_shoot_service_id !== undefined ? { source_shoot_service_id: service.source_shoot_service_id } : {}),
        ...(service.responsibility !== undefined ? { responsibility: service.responsibility } : {}),
        ...(service.responsible_staff_id !== undefined ? { responsible_staff_id: service.responsible_staff_id } : {}),
        ...(service.photographer_compensation_mode !== undefined
          ? { photographer_compensation_mode: service.photographer_compensation_mode }
          : {}),
        ...(service.photographer_pay !== undefined ? { photographer_pay: service.photographer_pay } : {}),
      }));
      const primaryServiceId = servicesPayload[0]?.id ?? null;
      const effectiveShootType = isCompReshootMode
        ? 'complimentary_reshoot'
        : canCreateNoProductShoot && servicesPayload.length === 0
          ? 'complimentary'
          : 'standard';
      const productStatus =
        servicesPayload.length === 0
          ? 'no_product'
          : totalQuote <= 0.01
            ? 'zero_dollar_product'
            : 'has_product';
      const isNoChargeShoot = totalQuote <= 0.01 || effectiveShootType !== 'standard';
      const scheduledAt = date && time24Hour 
        ? `${orderDate} ${time24Hour}`
        : null;
      const effectiveClientId = isClientAccount ? user?.id : client;
      const payload = {
        client_id: effectiveClientId,
        address,
        city,
        state: normalizedState, // Use normalized state
        zip,
        scheduled_at: scheduledAt, // Full datetime in format: "YYYY-MM-DD HH:MM:SS"
        scheduled_date: orderDate, // YYYY-MM-DD format (legacy support)
        time: time24Hour, // 24-hour format for backend
        photographer_id: photographer || null,
        service_photographers: Object.keys(servicePhotographers).length > 0
          ? Object.entries(servicePhotographers).map(([serviceId, photographerId]) => ({
              service_id: serviceId,
              photographer_id: photographerId,
            }))
          : undefined,
        service_id: primaryServiceId,
        services: servicesPayload,
        service_items: serviceItemsPayload,
        service_category: selectedServices[0]?.category?.name || undefined,
        shoot_type: effectiveShootType,
        ...(isCompReshootMode ? {
          policy_version: compReshoot.template?.policyVersion,
          source_shoot_id: compReshoot.sourceShootId,
          reshoot_parent_shoot_id: compReshoot.template?.parent.id || compReshoot.sourceShootId,
          reshoot_root_shoot_id: compReshoot.template?.root.id || compReshoot.sourceShootId,
          reason_code: compReshoot.reasonCode,
          reason_note: compReshoot.reasonNote.trim() || undefined,
          photographer_compensation_mode: compReshoot.photographerMode === 'custom'
            ? 'mixed'
            : compReshoot.photographerMode,
          sales_rep_compensation_mode: compReshoot.repMode,
          ...(compReshoot.repMode === 'custom'
            ? { sales_rep_compensation_amount: compReshoot.repCompensationTotal }
            : {}),
          nominal_service_total: serviceSubtotal,
        } : additionalWorkSourceId ? {
          reshoot_parent_shoot_id: additionalWorkSourceId,
          reshoot_classification: 'additional_work',
        } : {}),
        product_status: productStatus,
        shoot_notes: notes || undefined,
        company_notes: companyNotes || undefined,
        photographer_notes: photographerNotes || undefined,
        editor_notes: editorNotes || undefined,
        bypass_paywall: bypassPayment || isNoChargeShoot,
        send_notification: sendNotification,
        property_details: propertyDetails || undefined,
        base_quote: baseQuote,
        service_subtotal: pricingForSubmission.serviceSubtotal,
        discount_type: pricingForSubmission.discountType,
        discount_value: pricingForSubmission.discountValue,
        discount_amount: pricingForSubmission.discountAmount,
        tax_amount: taxAmount,
        total_quote: totalQuote,
        admin_adjusted_total_quote: adjustedTotalQuote ?? undefined,
        payment_status: isNoChargeShoot ? 'paid' : (bypassPayment ? 'pending' : 'paid'), // or whatever statuses your API expects
        created_by: user?.name || user?.email || 'System', // Use available user info
        is_client_request: isClientAccount,
      };
      try {
        const token = localStorage.getItem('authToken');
        const requestUrl = isEditMode && editShootId
          ? `${API_BASE_URL}/api/shoots/${editShootId}`
          : `${API_BASE_URL}/api/shoots`;
        const requestConfig = {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };
        let responsePayload: unknown;
        if (isEditMode && editShootId) {
          const editPayload = { ...payload } as Record<string, unknown>;
          [
            'service_id',
            'shoot_type',
            'product_status',
            'bypass_paywall',
            'payment_status',
            'base_quote',
            'service_subtotal',
            'discount_type',
            'discount_value',
            'discount_amount',
            'tax_amount',
            'total_quote',
          ].forEach((field) => delete editPayload[field]);

          let mutationResult = await submitShootServiceMutation({
            url: requestUrl,
            token,
            payload: editPayload,
          });

          let confirmationRounds = 0;
          while (mutationResult.kind === 'confirmation_required') {
            const { impact } = mutationResult.confirmation;
            const linkedRecords = impact.filesDetached + impact.albumsDetached + impact.uploadAttemptsDetached;
            const confirmed = window.confirm([
              `Remove ${impact.removedServices.map((service) => service.name).join(', ')}?`,
              impact.leavesNoServices ? 'Warning: this shoot will have no services.' : '',
              `Order total: $${impact.currentTotal.toFixed(2)} → $${impact.newTotal.toFixed(2)}.`,
              linkedRecords > 0 ? `${linkedRecords} linked media/upload record(s) will remain at shoot level.` : '',
              impact.paymentAllocationsReleased > 0
                ? `$${impact.paymentAllocationsReleased.toFixed(2)} in payment allocations will be redistributed.`
                : '',
              impact.refundCreditDue > 0
                ? `Refund/credit due: $${impact.refundCreditDue.toFixed(2)}. No automatic refund will be issued.`
                : '',
            ].filter(Boolean).join('\n\n'));

            if (!confirmed) {
              setIsSubmitting(false);
              return;
            }

            confirmationRounds += 1;
            if (confirmationRounds > 3) {
              throw new Error('The shoot keeps changing while you confirm. Refresh it and try again.');
            }

            mutationResult = await submitShootServiceMutation({
              url: requestUrl,
              token,
              payload: editPayload,
              confirmationToken: mutationResult.confirmation.token,
            });
          }
          responsePayload = mutationResult.data;
        } else if (isCompReshootMode && compReshoot.sourceShootId) {
          responsePayload = await createComplimentaryReshoot(
            compReshoot.sourceShootId,
            payload as ComplimentaryReshootCreatePayload,
            compReshoot.idempotencyKey,
          );
          compReshoot.rotateIdempotencyKey();
        } else {
          const response = await axios.post(requestUrl, payload, requestConfig);
          responsePayload = response.data;
        }
        const isClientRole = user?.role === 'client';
        toast({
          title: isEditMode
            ? "Shoot Updated!"
            : isCompReshootMode
              ? 'Comp reshoot booked!'
              : (isClientRole ? "Shoot Request Submitted!" : "Shoot Booked!"),
          description: isClientRole 
            ? "Your shoot request has been submitted for approval. We'll notify you once it's reviewed."
            : isEditMode
              ? "The shoot has been successfully updated."
              : isCompReshootMode
                ? 'The return visit was created with a $0 client total.'
                : "The shoot has been successfully created.",
          variant: "default"
        });
        const responseRecord = asRecord(responsePayload);
        const shootData = asRecord(responseRecord.data ?? responsePayload);
        const savedShootId = typeof shootData.id === 'string' || typeof shootData.id === 'number'
          ? shootData.id
          : undefined;
        const completedSnapshot: CompletedBookingSnapshot = {
          date,
          time,
          shootId: savedShootId,
          totalAmount: getTotal(),
          pricing: pricingForSubmission,
          shootAddress: buildNormalizedAddress({ address, city, state, zip }),
          shootServices: selectedServices.map((service) => service.name),
          clientName: user?.name,
          clientEmail: user?.email,
          shoot: shootData,
        };
        if (savedShootId !== undefined) {
          setCreatedShootId(savedShootId);
        }
        setCompletedBooking(completedSnapshot);
        clearBookingDraftState();
        duplicateLocationWarningAcceptedRef.current = false;
        largeHomePackageWarningAcceptedRef.current = false;
        setIsComplete(true);
        fetchShoots().catch(() => {});
        if (shouldCacheForm) {
          localStorage.removeItem(CACHE_KEY);
        }
        console.log("Shoot saved response:", responsePayload);
      } catch (error: unknown) {
        const errorDetails = asRecord(error);
        const errorResponse = asRecord(errorDetails.response);
        const responseData = asRecord(errorResponse.data);
        console.error("Error creating shoot:", error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : undefined,
          response: responseData,
          status: errorResponse.status,
          statusText: errorResponse.statusText,
        });
        const validationErrors = asRecord(responseData.errors);
        if (Object.keys(validationErrors).length > 0) {
          const errorMessages = Object.values(validationErrors).flatMap((value) =>
            Array.isArray(value) ? value.map(String) : [String(value)],
          );
          toast({
            title: "Validation Error",
            description: errorMessages.join('. '),
            variant: "destructive"
          });
        } else if (typeof responseData.message === 'string' && responseData.message) {
          toast({
            title: "Error",
            description: responseData.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: `Failed to create shoot (${String(errorResponse.status || 'Unknown error')}). Please check the console for details.`,
            variant: "destructive"
          });
        }
        setIsSubmitting(false);
      }
    } else {
      if (!validateCurrentStep()) {
        return;
      }
      setStep(step + 1);
    }
  };
  const goBack = () => {
    if (step > 1) {
      setFormErrors({});
      setStep(step - 1);
    }
  };
  const resetForm = () => {
    clearBookingDraftState();
    duplicateLocationWarningAcceptedRef.current = false;
    setIsComplete(false);
    setCompletedBooking(null);
    setCreatedShootId(undefined);
    if (shouldCacheForm) {
      clearBookingFormCache(typeof window !== 'undefined' ? window.localStorage : null, CACHE_KEY);
      setHasCachedData(false);
    }
    navigate(BOOK_ANOTHER_SHOOT_NAV_TARGET);
  };
  const handleAddressFieldsChange = React.useCallback(
    ({ address: newAddress, city: newCity, state: newState, zip: newZip }: { address: string; city: string; state: string; zip: string }) => {
      setAddress(newAddress);
      setCity(newCity);
      setState(normalizeState(newState) || newState);
      setZip(newZip);
    },
    [setAddress, setCity, setState, setZip]
  );
  const handleClientChange = React.useCallback((clientId: string) => {
    setClient(clientId);
  }, [setClient]);
  const handlePropertyDraftChange = React.useCallback(
    (data: PropertyDraftSubmission) => {
      if (!data) return;
      if (!isClientAccount && typeof data.clientId === 'string') {
        setClient(data.clientId);
      }
      if (typeof data.shootNotes === 'string' || typeof data.propertyInfo === 'string') {
        setNotes(data.shootNotes || data.propertyInfo || '');
      }
      if (typeof data.companyNotes === 'string') {
        setCompanyNotes(data.companyNotes);
      }
      if (typeof data.photographerNotes === 'string') {
        setPhotographerNotes(data.photographerNotes);
      }
      if (typeof data.editorNotes === 'string') {
        setEditorNotes(data.editorNotes);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'property_details')) {
        setPropertyDetails(data.property_details || null);
      }
      const derivedSqft =
        (data.sqft !== undefined && data.sqft !== null && data.sqft !== '' ? Number(data.sqft) : null) ??
        data.property_details?.sqft ??
        data.property_details?.livingArea ??
        null;
      setPropertySqft(derivedSqft !== null && !Number.isNaN(Number(derivedSqft)) ? Number(derivedSqft) : null);
    },
    [
      isClientAccount, setClient, setCompanyNotes, setEditorNotes, setNotes,
      setPhotographerNotes, setPropertyDetails, setPropertySqft,
    ],
  );
  const updateClientCompanyNotes = React.useCallback(
    async (clientId: string, notesValue: string) => {
      if (!clientId) return;
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;
        await axios.put(
          `${API_BASE_URL}/api/admin/users/${clientId}`,
          { company_notes: notesValue || '' },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );
        setClients((prev) =>
          prev.map((clientItem) =>
            clientItem.id === clientId
              ? {
                  ...clientItem,
                  companyNotes: notesValue,
                }
              : clientItem
          )
        );
      } catch (error) {
        console.error('Failed to update company notes for client:', error);
        toast({
          title: 'Company notes not saved',
          description: 'We could not save the company notes for this client.',
          variant: 'destructive',
        });
      }
    },
    [setClients, toast]
  );
  const handleClearCache = () => {
    if (shouldCacheForm) {
      localStorage.removeItem(CACHE_KEY);
      clearBookingDraftState();
      toast({
        title: 'Form cleared',
        description: 'All saved form data has been cleared.',
      });
    }
  };
  const clientPropertyFormData = React.useMemo(() => ({
    formKey: clientPropertyFormKey,
    initialData: {
      clientId: client,
      clientName: isClientAccount ? user?.name || '' : clients.find(c => c.id === client)?.name || '',
      clientEmail: isClientAccount ? user?.email || '' : clients.find(c => c.id === client)?.email || '',
      clientPhone: isClientAccount ? (user?.metadata?.phone || user?.phone || '') : clients.find(c => c.id === client)?.phone || '',
      clientCompany: isClientAccount ? (user?.metadata?.company || user?.company || '') : clients.find(c => c.id === client)?.company || '',
      propertyType: 'residential' as const,
      propertyAddress: address,
      propertyCity: city,
      propertyState: state,
      propertyZip: zip,
      completeAddress: propertyDetails?.completeAddress ?? address,
      aptSuite: propertyDetails?.aptSuite ?? undefined,
      propertyInfo: notes,
      shootNotes: notes,
      companyNotes: companyNotes,
      photographerNotes: photographerNotes,
      editorNotes: editorNotes,
      listingType: propertyDetails?.listingType ?? undefined,
      presenceOption: propertyDetails?.presenceOption ?? undefined,
      propertyDetails: propertyDetails,
      property_details: propertyDetails,
      bedRooms: propertyDetails?.bedrooms ?? propertyDetails?.bedRooms ?? undefined,
      bathRooms: propertyDetails?.bathrooms ?? propertyDetails?.bathRooms ?? undefined,
      sqft: propertySqft ?? undefined,
      lockboxCode: propertyDetails?.lockboxCode ?? undefined,
      lockboxLocation: propertyDetails?.lockboxLocation ?? undefined,
      accessContactName: propertyDetails?.accessContactName ?? undefined,
      accessContactPhone: propertyDetails?.accessContactPhone ?? undefined,
      selectedPackage: selectedServices[0]?.id || ''
    },
    onComplete: (data: PropertyDraftSubmission) => {
      if (!isClientAccount && data.clientId) {
        setClient(data.clientId);
      }
      setAddress(data.completeAddress || data.propertyAddress);
      setCity(data.propertyCity);
      const normalizedState = normalizeState(data.propertyState);
      setState(normalizedState || data.propertyState);
      setZip(data.propertyZip);
      setNotes(data.shootNotes || data.propertyInfo || '');
      setCompanyNotes(data.companyNotes || '');
      setPhotographerNotes(data.photographerNotes || '');
      setEditorNotes(data.editorNotes || '');
      setPropertyDetails(data.property_details || null);
      const derivedSqft =
        (data.sqft && Number(data.sqft)) ||
        data.property_details?.sqft ||
        data.property_details?.livingArea ||
        null;
      setPropertySqft(derivedSqft);
      if (!isClientAccount && data.clientId) {
        const existingNotes = clients.find((c) => c.id === data.clientId)?.companyNotes || '';
        const nextNotes = data.companyNotes || '';
        if (existingNotes !== nextNotes) {
          updateClientCompanyNotes(data.clientId, nextNotes);
        }
      }
      if (isCompReshootMode && !compReshoot.reasonIsComplete) {
        toast({
          title: 'Choose a comp reason',
          description: 'Select why the return visit is needed before scheduling it.',
          variant: 'destructive',
        });
        return;
      }
      if (isCompReshootMode && !compReshoot.mappingIsComplete) {
        toast({
          title: 'Complete source service mapping',
          description: 'Link each selected service to its affected source item and responsibility.',
          variant: 'destructive',
        });
        return;
      }
      setStep(2);
    },
    isClientAccount: isClientAccount,
    selectedServices,
    onSelectedServicesChange: handleSelectedServicesChange,
    packagesLoading,
  }), [
    address, city, client, clientPropertyFormKey, clients, companyNotes, editorNotes,
    handleSelectedServicesChange, isClientAccount, notes, packagesLoading,
    photographerNotes, propertyDetails, propertySqft, selectedServices, setAddress,
    setCity, setClient, setCompanyNotes, setEditorNotes, setNotes, setPhotographerNotes,
    setPropertyDetails, setPropertySqft, setState, setStep, setZip, state,
    updateClientCompanyNotes, user, zip, isCompReshootMode,
    compReshoot.reasonIsComplete, compReshoot.mappingIsComplete, toast,
  ]);
  const getSummaryInfo = () => {
    const serviceNames = selectedServices.map(service => service.name).join(', ');
    let repName: string | undefined = undefined;
    if (selectedClientData) {
      const selectedClientRecord = asRecord(selectedClientData);
      if (typeof selectedClientRecord.rep === 'string') {
        repName = selectedClientRecord.rep;
      }
      else if (selectedClientRecord.repObject) {
        const repObj = selectedClientRecord.repObject;
        const repRecord = asRecord(repObj);
        if (typeof repRecord.name === 'string') {
          repName = repRecord.name;
        } else if (typeof repObj === 'string') {
          repName = repObj;
        }
      }
      if (!repName) {
        const fallbackRep = selectedClientRecord.rep_name
          || selectedClientRecord.sales_rep
          || selectedClientRecord.salesRep;
        repName = typeof fallbackRep === 'string' ? fallbackRep : undefined;
      }
    }
    const fullAddress = buildNormalizedAddress({ address, city, state, zip });
    return {
      client: selectedClientData?.name || (isClientAccount ? user?.name || '' : ''),
      clientRep: repName,
      services: selectedServices,
      packageLabel: serviceNames,
      packagePrice: displayPricingBreakdown.serviceSubtotal,
      pricing: displayPricingBreakdown,
      address: fullAddress || address || '',
      bedrooms: 0,
      bathrooms: 0,
      sqft: 0,
      date: date ? formatDate(date) : '',
      time: time || '',
  };
};
  const { temperature, condition } = useWeatherData({ date, time, city, state, zip, address });
  const parsedTemperature =
    temperature !== undefined && temperature !== null && !Number.isNaN(Number(temperature))
      ? Number(temperature)
      : undefined;
  const summaryInfo = getSummaryInfo();
  const getCurrentStepContent = () => {
    return bookingWizard.steps[step - 1] || { title: '', description: '' };
  };
  const currentStepContent = getCurrentStepContent();
  const canSubmitBooking = isFormComplete && (!isCompReshootMode || compReshoot.isValid);
  const openCompReshootSource = React.useCallback(() => {
    if (compReshoot.sourceShootId) navigate(`/shoots/${compReshoot.sourceShootId}`);
  }, [compReshoot.sourceShootId, navigate]);
  const confirmExitCompReshoot = React.useCallback(() => {
    setExitCompDialogOpen(false);
    clearBookingDraftState();
    navigate('/book-shoot', { replace: true });
  }, [clearBookingDraftState, navigate]);
  const convertToAdditionalWork = React.useCallback(() => {
    const sourceId = compReshoot.sourceShootId;
    if (!sourceId) return;
    setPositiveChargeDialogOpen(false);
    setShootType('standard');
    setBypassPayment(false);
    setAdjustedTotalInput('');
    setStep((current) => Math.min(current, 3));
    navigate(`/book-shoot?reshootOf=${encodeURIComponent(sourceId)}`, { replace: true });
  }, [compReshoot.sourceShootId, navigate, setAdjustedTotalInput, setBypassPayment, setShootType, setStep]);

  return {
    isMobile, isEditMode, editShootLoading, packages, packagesLoading, clients, client,
    setClient, address, setAddress, city, setCity, state, setState, zip, setZip, date,
    setDate, time, setTime, photographer, setPhotographer, servicePhotographers,
    setServicePhotographers, serviceSchedules, setServiceSchedules, selectedServices,
    handleSelectedServicesChange, shootType, handleShootTypeChange, propertyDetails,
    propertySqft, notes, companyNotes, photographerNotes, editorNotes, bypassPayment,
    setBypassPayment, sendNotification, setSendNotification, adjustedTotalInput,
    setAdjustedTotalInput, step, isComplete, completedBooking, isSubmitting,
    duplicateLocationDialogOpen, setDuplicateLocationDialogOpen, createdShootId, formErrors,
    setFormErrors, clientPropertyFormKey, toast, photographers, availablePhotographerIds,
    availabilityChecked, canAdjustBookingAmount, canCreateNoProductShoot, isClientAccount,
    isFormComplete, canSubmitBooking, sameDayAddressShoot, sameAddressScheduledDates,
    addressScheduledWarningMessage, sameDayAddressWarningMessage, duplicateLocationWarningShoot,
    duplicateLocationPopupMessage, showAddressScheduledWarning, hasCachedData,
    clearBookingDraftState, selectedClientData, selectedServiceSqft, serviceSubtotal,
    pricingBreakdown, parsedAdjustedTotal, displayPricingBreakdown, getPackagePrice,
    getPhotographerRate, getTax, getTotal, getAvailablePhotographers, validateCurrentStep,
    handleSubmit, goBack, resetForm, handleAddressFieldsChange, handleClientChange,
    handlePropertyDraftChange, updateClientCompanyNotes, handleClearCache,
    clientPropertyFormData, getSummaryInfo, parsedTemperature, condition, summaryInfo,
    currentStepContent,
    compReshoot, isCompReshootMode, positiveChargeDialogOpen, setPositiveChargeDialogOpen,
    exitCompDialogOpen, setExitCompDialogOpen, openCompReshootSource,
    confirmExitCompReshoot, convertToAdditionalWork,
    buildNormalizedAddress, user,
    shouldCacheForm, setNotes, duplicateLocationWarningAcceptedRef,
  };
};

export type BookShootController = ReturnType<typeof useBookShootController>;
