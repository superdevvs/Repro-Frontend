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
import {
  buildAdminAdjustedPricing,
  asRecord,
  buildNormalizedAddress,
  getDateKey,
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
  const { user, isImpersonating } = useAuth();
  const canAdjustBookingAmount = !isImpersonating && (user?.role === 'admin' || user?.role === 'superadmin');
  const isClientAccount = Boolean(user && (user.role as string) === 'client');
  const canCreateNoProductShoot = !isImpersonating && ['superadmin', 'editing_manager', 'admin', 'salesRep', 'salesrep', 'sales_rep', 'rep'].includes(String(user?.role ?? ''));
  const {
    isEditMode, setIsEditMode, editShootLoading, packages, packagesLoading, setPackagesLoading,
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
    () => buildAdminAdjustedPricing(pricingBreakdown, parsedAdjustedTotal, getTaxRateForState(state)),
    [pricingBreakdown, parsedAdjustedTotal, state]
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
  const validateCurrentStep = () => {
    if (step === 1) {
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
    if (step === 2) {
      const errors = {};
      if (!date) errors['date'] = "Please select a date";
      if (!time) errors['time'] = "Please select a time";
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return false;
      }
      return true;
    }
    return true;
  };
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setFormErrors({});
    if (step === 3) {
      setIsSubmitting(true);
      const clientValid = isClientAccount || !!client;
      const requiresServices = isClientAccount || !canCreateNoProductShoot;
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
      if (duplicateLocationPopupMessage && !duplicateLocationWarningAcceptedRef.current) {
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
      const pricingForSubmission = buildAdminAdjustedPricing(
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
        return {
          id: service.id,
          price: resolveSelectedServicePrice(service, sqft),
          quantity: 1,
          photographer_id: assignedPhotographerId,
          scheduled_at: resolveServiceScheduledAt(service.id),
          is_deliverable: true,
        };
      });
      const serviceItemsPayload = servicesPayload.map(service => ({
        service_id: service.id,
        price: service.price,
        quantity: service.quantity,
        photographer_id: service.photographer_id,
        scheduled_at: service.scheduled_at,
        is_deliverable: true,
      }));
      const primaryServiceId = servicesPayload[0]?.id ?? null;
      const effectiveShootType =
        canCreateNoProductShoot && servicesPayload.length === 0
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
        const response = isEditMode && editShootId
          ? await axios.patch(requestUrl, payload, requestConfig)
          : await axios.post(requestUrl, payload, requestConfig);
        const isClientRole = user?.role === 'client';
        toast({
          title: isEditMode ? "Shoot Updated!" : (isClientRole ? "Shoot Request Submitted!" : "Shoot Booked!"),
          description: isClientRole 
            ? "Your shoot request has been submitted for approval. We'll notify you once it's reviewed."
            : isEditMode ? "The shoot has been successfully updated." : "The shoot has been successfully created.",
          variant: "default"
        });
        const shootData = response.data?.data || response.data;
        const completedSnapshot: CompletedBookingSnapshot = {
          date,
          time,
          shootId: shootData?.id,
          totalAmount: getTotal(),
          pricing: pricingForSubmission,
          shootAddress: buildNormalizedAddress({ address, city, state, zip }),
          shootServices: selectedServices.map((service) => service.name),
          clientName: user?.name,
          clientEmail: user?.email,
          shoot: shootData,
        };
        if (shootData?.id) {
          setCreatedShootId(shootData.id);
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
        console.log("Shoot created response:", response.data);
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
    updateClientCompanyNotes, user, zip,
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
    const stepContent = {
      1: {
        title: "Book a new shoot",
        description: "Select a client and enter the property information"
      },
      2: {
        title: "Schedule",
        description: "Choose a convenient date and time for the shoot"
      },
      3: {
        title: "Review & Confirm",
        description: "Verify all the details before confirming the booking"
      }
    };
    return stepContent[step as keyof typeof stepContent] || { title: '', description: '' };
  };
  const currentStepContent = getCurrentStepContent();

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
    isFormComplete, sameDayAddressShoot, sameAddressScheduledDates,
    addressScheduledWarningMessage, sameDayAddressWarningMessage, duplicateLocationWarningShoot,
    duplicateLocationPopupMessage, showAddressScheduledWarning, hasCachedData,
    clearBookingDraftState, selectedClientData, selectedServiceSqft, serviceSubtotal,
    pricingBreakdown, parsedAdjustedTotal, displayPricingBreakdown, getPackagePrice,
    getPhotographerRate, getTax, getTotal, getAvailablePhotographers, validateCurrentStep,
    handleSubmit, goBack, resetForm, handleAddressFieldsChange, handleClientChange,
    handlePropertyDraftChange, updateClientCompanyNotes, handleClearCache,
    clientPropertyFormData, getSummaryInfo, parsedTemperature, condition, summaryInfo,
    currentStepContent,
    buildNormalizedAddress, user,
    shouldCacheForm, setNotes, duplicateLocationWarningAcceptedRef,
  };
};

export type BookShootController = ReturnType<typeof useBookShootController>;
