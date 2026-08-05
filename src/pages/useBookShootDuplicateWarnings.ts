import React, { useEffect, useRef } from 'react';
import type { useAuth } from '@/components/auth/AuthProvider';
import type { useShoots } from '@/context/shootsContextState';
import type { useUserPreferences } from '@/contexts/UserPreferencesContext';
import {
  duplicateCheckIgnoredStatuses,
  duplicateLocationWarningStatuses,
  asRecord,
  getDateKey,
  normalizeDuplicateAddressKey,
  buildNormalizedAddress,
  shouldWarnForLargeHomePhotoCount,
  toTimeInputValue,
  type ServicePackage,
} from './bookShootModel';

type BookShootDuplicateWarningsOptions = {
  user: ReturnType<typeof useAuth>['user'];
  shoots: ReturnType<typeof useShoots>['shoots'];
  fetchShoots: ReturnType<typeof useShoots>['fetchShoots'];
  formatDate: ReturnType<typeof useUserPreferences>['formatDate'];
  address: string;
  city: string;
  state: string;
  zip: string;
  date?: Date;
  time: string;
  step: number;
  editShootId: string | null;
  selectedServices: ServicePackage[];
  isClientAccount: boolean;
  client: string;
  canCreateNoProductShoot: boolean;
  to12Hour: (time: string) => string;
};

export const useBookShootDuplicateWarnings = ({
  user, shoots, fetchShoots, formatDate, address, city, state, zip, date, time,
  step, editShootId, selectedServices,
  isClientAccount, client, canCreateNoProductShoot, to12Hour,
}: BookShootDuplicateWarningsOptions) => {
  const duplicateLocationWarningAcceptedRef = useRef(false);
  const largeHomePackageWarningAcceptedRef = useRef(false);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);
  const isFormComplete = React.useMemo(() => {
    const hasClient = isClientAccount || !!client;
    const hasAddress = !!address?.trim();
    const hasCity = !!city?.trim();
    const hasState = !!state?.trim();
    const hasZip = !!zip?.trim();
    const hasDate = !!date;
    const hasTime = !!time?.trim();
    const requiresServices = isClientAccount || !canCreateNoProductShoot;
    const hasServices = !requiresServices || selectedServices.length > 0;
    return hasClient && hasAddress && hasCity && hasState && hasZip && hasDate && hasTime && hasServices;
  }, [isClientAccount, client, address, city, state, zip, date, time, selectedServices, canCreateNoProductShoot]);
  const sameDayAddressShoot = React.useMemo(() => {
    const selectedDateKey = getDateKey(date);
    const selectedAddressKey = normalizeDuplicateAddressKey(
      buildNormalizedAddress({ address, city, state, zip }) || address,
    );
    if (!selectedDateKey || !selectedAddressKey) {
      return undefined;
    }
    return shoots.find((shoot) => {
      if (!shoot || (editShootId && String(shoot.id) === String(editShootId))) {
        return false;
      }
      const statusKey = String(shoot.status || shoot.workflowStatus || '').trim().toLowerCase();
      if (duplicateCheckIgnoredStatuses.has(statusKey)) {
        return false;
      }
      if (getDateKey(shoot.scheduledDate) !== selectedDateKey) {
        return false;
      }
      const location = shoot.location;
      if (!location) {
        return false;
      }
      const shootAddressKeys = [
        location.fullAddress,
        buildNormalizedAddress({
          address: location.address,
          city: location.city,
          state: location.state,
          zip: location.zip,
        }),
      ]
        .map(normalizeDuplicateAddressKey)
        .filter(Boolean);
      return shootAddressKeys.includes(selectedAddressKey);
    });
  }, [address, city, date, editShootId, shoots, state, zip]);
  const sameAddressScheduledDates = React.useMemo(() => {
    const selectedAddressKey = normalizeDuplicateAddressKey(
      buildNormalizedAddress({ address, city, state, zip }) || address,
    );
    const todayDateKey = getDateKey(new Date());
    if (!selectedAddressKey) {
      return [];
    }
    const dateKeys = shoots
      .filter((shoot) => {
        if (!shoot || (editShootId && String(shoot.id) === String(editShootId))) {
          return false;
        }
        const scheduledDateKey = getDateKey(shoot.scheduledDate);
        if (!scheduledDateKey || scheduledDateKey < todayDateKey) {
          return false;
        }
        const statusKey = String(shoot.status || shoot.workflowStatus || '').trim().toLowerCase();
        if (duplicateCheckIgnoredStatuses.has(statusKey)) {
          return false;
        }
        const location = shoot.location;
        if (!location) {
          return false;
        }
        const shootAddressKeys = [
          location.fullAddress,
          buildNormalizedAddress({
            address: location.address,
            city: location.city,
            state: location.state,
            zip: location.zip,
          }),
        ]
          .map(normalizeDuplicateAddressKey)
          .filter(Boolean);
        return shootAddressKeys.includes(selectedAddressKey);
      })
      .map((shoot) => getDateKey(shoot.scheduledDate))
      .filter(Boolean);
    return Array.from(new Set(dateKeys)).sort();
  }, [address, city, editShootId, shoots, state, zip]);
  const formatDateKeyForWarning = React.useCallback((dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    if (!year || !month || !day) {
      return dateKey;
    }
    return formatDate(new Date(year, month - 1, day, 12, 0, 0));
  }, [formatDate]);
  const addressScheduledWarningMessage = React.useMemo(() => {
    if (sameAddressScheduledDates.length === 0) {
      return '';
    }
    const displayDates = sameAddressScheduledDates.slice(0, 3).map(formatDateKeyForWarning);
    const remainingCount = sameAddressScheduledDates.length - displayDates.length;
    const datesLabel = [
      displayDates.join(', '),
      remainingCount > 0 ? `and ${remainingCount} more` : '',
    ].filter(Boolean).join(' ');
    return sameAddressScheduledDates.length === 1
      ? `A shoot is already scheduled at this address on ${datesLabel}. Please check this before selecting date and time.`
      : `Shoots are already scheduled at this address on ${datesLabel}. Please check these before selecting date and time.`;
  }, [formatDateKeyForWarning, sameAddressScheduledDates]);
  const sameDayAddressWarningMessage = React.useMemo(() => {
    if (!sameDayAddressShoot || !date) {
      return '';
    }
    return `A shoot is already scheduled at this address for ${formatDate(date)}. Please check this before selecting a time.`;
  }, [date, formatDate, sameDayAddressShoot]);
  const duplicateLocationWarningShoot = React.useMemo(() => {
    const selectedAddressKey = normalizeDuplicateAddressKey(
      buildNormalizedAddress({ address, city, state, zip }) || address,
    );
    if (!date || !selectedAddressKey) {
      return undefined;
    }
    const selectedTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12,
    ).getTime();
    const oneMonthMs = 31 * 24 * 60 * 60 * 1000;
    const candidates = shoots
      .filter((shoot) => {
        if (!shoot || (editShootId && String(shoot.id) === String(editShootId))) {
          return false;
        }
        const statusKeys = [
          shoot.status,
          shoot.workflowStatus,
          asRecord(shoot).workflow_status,
        ]
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean);
        if (!statusKeys.some((statusKey) => duplicateLocationWarningStatuses.has(statusKey))) {
          return false;
        }
        const existingDateKey = getDateKey(shoot.scheduledDate || String(asRecord(shoot).scheduled_date || ''));
        if (!existingDateKey) {
          return false;
        }
        const [year, month, day] = existingDateKey.split('-').map(Number);
        if (!year || !month || !day) {
          return false;
        }
        const existingTime = new Date(year, month - 1, day, 12).getTime();
        if (Math.abs(existingTime - selectedTime) > oneMonthMs) {
          return false;
        }
        const location = shoot.location;
        if (!location) {
          return false;
        }
        const shootAddressKeys = [
          location.fullAddress,
          buildNormalizedAddress({
            address: location.address,
            city: location.city,
            state: location.state,
            zip: location.zip,
          }),
        ]
          .map(normalizeDuplicateAddressKey)
          .filter(Boolean);
        return shootAddressKeys.includes(selectedAddressKey);
      })
      .sort((a, b) => {
        const aDate = getDateKey(a.scheduledDate || String(asRecord(a).scheduled_date || ''));
        const bDate = getDateKey(b.scheduledDate || String(asRecord(b).scheduled_date || ''));
        return Math.abs(new Date(`${aDate}T12:00:00`).getTime() - selectedTime) - Math.abs(new Date(`${bDate}T12:00:00`).getTime() - selectedTime);
      });
    return candidates[0];
  }, [address, city, date, editShootId, shoots, state, zip]);
  const duplicateLocationPopupMessage = React.useMemo(() => {
    if (!duplicateLocationWarningShoot) {
      return '';
    }
    const scheduledDateKey = getDateKey(
      duplicateLocationWarningShoot.scheduledDate || String(asRecord(duplicateLocationWarningShoot).scheduled_date || ''),
    );
    const scheduledDateLabel = scheduledDateKey
      ? formatDateKeyForWarning(scheduledDateKey)
      : 'a nearby date';
    const scheduledTime = duplicateLocationWarningShoot.time
      ? to12Hour(toTimeInputValue(duplicateLocationWarningShoot.time))
      : 'the scheduled time';
    const statusKeys = [
      duplicateLocationWarningShoot.status,
      duplicateLocationWarningShoot.workflowStatus,
      asRecord(duplicateLocationWarningShoot).workflow_status,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    const statusLabel = statusKeys.some((statusKey) => ['scheduled', 'booked'].includes(statusKey))
      ? 'scheduled'
      : 'completed';
    return `This shoot has already been ${statusLabel} on ${scheduledDateLabel} at ${scheduledTime}. Are you sure you want to schedule it again?`;
  }, [duplicateLocationWarningShoot, formatDateKeyForWarning, to12Hour]);
  useEffect(() => {
    duplicateLocationWarningAcceptedRef.current = false;
  }, [address, city, date, state, time, zip]);
  const showAddressScheduledWarning = step === 1 && Boolean(addressScheduledWarningMessage);
  return {
    duplicateLocationWarningAcceptedRef, largeHomePackageWarningAcceptedRef,
    isFormComplete, sameDayAddressShoot, sameAddressScheduledDates,
    addressScheduledWarningMessage, sameDayAddressWarningMessage,
    duplicateLocationWarningShoot, duplicateLocationPopupMessage,
    showAddressScheduledWarning,
  };
};
