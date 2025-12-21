import API_ROUTES from '@/lib/api';

export interface AvailabilitySlot {
  id?: number;
  photographer_id: number | string;
  date?: string | null;
  day_of_week?: string | null;
  start_time: string;
  end_time: string;
  status?: 'available' | 'unavailable';
}

export interface PhotographerAvailability {
  isAvailable: boolean;
  nextAvailableTimes: string[];
  availabilitySlots: AvailabilitySlot[];
}

/**
 * Normalize time string to HH:mm format (removes seconds if present)
 */
function normalizeTime(time: string): string {
  if (!time) return '';
  // Remove seconds if present (HH:mm:ss -> HH:mm)
  return time.split(':').slice(0, 2).join(':');
}

/**
 * Check if a photographer is available at a specific time
 */
export function isTimeInSlot(time: string, slot: AvailabilitySlot): boolean {
  // Normalize times to HH:mm format
  const normalizedTime = normalizeTime(time);
  const normalizedStart = normalizeTime(slot.start_time);
  const normalizedEnd = normalizeTime(slot.end_time);

  const [timeHour, timeMin] = normalizedTime.split(':').map(Number);
  const [startHour, startMin] = normalizedStart.split(':').map(Number);
  const [endHour, endMin] = normalizedEnd.split(':').map(Number);

  const timeMinutes = timeHour * 60 + timeMin;
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Check if time falls within the slot (inclusive start, inclusive end)
  // For availability slots, both start and end times are typically inclusive
  // Also allow exact match with start_time (common case)
  return (timeMinutes >= startMinutes && timeMinutes <= endMinutes) || 
         (normalizedTime === normalizedStart);
}

/**
 * Convert 24-hour time to 12-hour format
 */
export function to12Hour(time24: string): string {
  if (!time24) return '';
  // Handle already formatted times (with AM/PM)
  if (time24.includes('AM') || time24.includes('PM')) {
    return time24;
  }
  const timeStr = time24.slice(0, 5); // Get HH:MM format (24-hour)
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24; // Return as-is if invalid
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Convert 12-hour time to 24-hour format
 */
export function to24Hour(time12: string): string {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Get photographer availability for a specific date
 */
export async function getPhotographerAvailability(
  photographerId: string | number,
  date: Date,
  photographerName?: string
): Promise<PhotographerAvailability> {
  try {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    // Ensure photographer_id is a number (backend expects integer)
    const photographerIdNum = typeof photographerId === 'string' ? parseInt(photographerId, 10) : photographerId;

    // Calculate day of week
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Fetching availability for photographer

    const response = await fetch(API_ROUTES.photographerAvailability.check, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        photographer_id: photographerIdNum,
        date: formattedDate,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Availability Fetch Error]', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return {
        isAvailable: false,
        nextAvailableTimes: [],
        availabilitySlots: [],
      };
    }

    const json = await response.json();
    const slots: AvailabilitySlot[] = json?.data || [];

    // Availability response received

    // Debug: Also fetch ALL availability for this photographer to see what exists
    if (slots.length === 0) {
      try {
        const allAvailabilityResponse = await fetch(
          API_ROUTES.photographerAvailability.list(photographerIdNum),
          { headers }
        );
        if (allAvailabilityResponse.ok) {
          const allAvailabilityJson = await allAvailabilityResponse.json();
          const totalSlots = allAvailabilityJson?.data?.length || 0;
          // Debug: Checking all availability for photographer
          if (totalSlots === 0) {
            // Photographer has no availability slots - this is expected for new photographers
          }
        }
      } catch (error) {
        console.error('Error fetching all availability for debugging:', error);
      }
    }

    // No slots found for this date - photographer may not be available

    // Filter out unavailable slots
    // Note: If status is null/undefined, treat as 'available' (default)
    // Only filter out if status is explicitly 'unavailable'
    const availableSlots = slots.filter(
      (slot) => {
        const status = slot.status;
        // Treat null, undefined, 'available', or any other value (except 'unavailable') as available
        const isAvailable = status !== 'unavailable';
        console.debug('[Availability Slot Filter]', {
          slot: {
            id: slot.id,
            photographer_id: slot.photographer_id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            status: slot.status,
            statusType: typeof slot.status,
            date: slot.date,
            day_of_week: slot.day_of_week
          },
          status,
          isAvailable,
          willInclude: isAvailable
        });
        return isAvailable;
      }
    );

    console.debug('[Availability Filtered]', {
      totalSlots: slots.length,
      availableSlotsCount: availableSlots.length,
      availableSlots: availableSlots.map(s => ({
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        date: s.date,
        day_of_week: s.day_of_week
      }))
    });

    // Extract all unique start times from available slots for next available times
    const allStartTimes = availableSlots
      .map((slot) => normalizeTime(slot.start_time))
      .filter((time) => time && time.length > 0)
      .sort()
      .filter((time, index, arr) => arr.indexOf(time) === index); // Remove duplicates

    return {
      isAvailable: availableSlots.length > 0,
      nextAvailableTimes: allStartTimes,
      availabilitySlots: availableSlots,
    };
  } catch (error) {
    console.error('Error fetching photographer availability:', error);
    return {
      isAvailable: false,
      nextAvailableTimes: [],
      availabilitySlots: [],
    };
  }
}

/**
 * Check if photographer is available at a specific time on a specific date
 */
export async function checkPhotographerAvailabilityAtTime(
  photographerId: string | number,
  date: Date,
  time: string,
  photographerName?: string
): Promise<{ isAvailable: boolean; nextAvailableTimes: string[] }> {
  const availability = await getPhotographerAvailability(photographerId, date, photographerName);
  
  // Convert time to 24-hour format, handling edge cases
  let time24: string;
  try {
    time24 = to24Hour(time);
  } catch (error) {
    console.error('Error converting time:', error, time);
    // If conversion fails, assume it's already in 24-hour format
    time24 = normalizeTime(time);
  }

  // Normalize the time for comparison
  const normalizedTime24 = normalizeTime(time24);

  console.debug('[Availability Check Start]', {
    photographerId,
    selectedTime: time,
    time24: normalizedTime24,
    slotsCount: availability.availabilitySlots.length,
    slots: availability.availabilitySlots.map(s => ({
      start_time: s.start_time,
      end_time: s.end_time,
      status: s.status,
      normalizedStart: normalizeTime(s.start_time),
      normalizedEnd: normalizeTime(s.end_time)
    }))
  });

  // No slots found for photographer on this date

  // Check if the selected time falls within any available slot
  let matchedSlot: AvailabilitySlot | null = null;
  const isAvailable = availability.availabilitySlots.some((slot) => {
    const slotStart = normalizeTime(slot.start_time);
    const slotEnd = normalizeTime(slot.end_time);
    
    // Validate that we have valid times
    if (!slotStart || !slotEnd || !normalizedTime24) {
      // Invalid time format in slot - skipping
      return false;
    }
    
    // Check if time matches start_time exactly (most common case - exact match)
    if (normalizedTime24 === slotStart) {
      console.debug('[Availability] ✓ Exact match with start_time', { slotStart, normalizedTime24 });
      matchedSlot = slot;
      return true;
    }
    
    // Check if time falls within the slot range (inclusive start, inclusive end)
    // For availability, if slot is 11:00-15:00, times 11:00, 11:40, 14:59, and 15:00 should all be available
    const [timeHour, timeMin] = normalizedTime24.split(':').map(Number);
    const [startHour, startMin] = slotStart.split(':').map(Number);
    const [endHour, endMin] = slotEnd.split(':').map(Number);

    // Validate parsed values
    if (isNaN(timeHour) || isNaN(timeMin) || isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      console.warn('[Availability] Failed to parse time values', {
        normalizedTime24,
        slotStart,
        slotEnd,
        parsed: { timeHour, timeMin, startHour, startMin, endHour, endMin }
      });
      return false;
    }

    const timeMinutes = timeHour * 60 + timeMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Use <= for end time to make it inclusive (availability slots typically include the end time)
    const inRange = timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    console.debug('[Availability] Range check', {
      selectedTime: time,
      time24: normalizedTime24,
      timeMinutes,
      slotStart,
      slotEnd,
      startMinutes,
      endMinutes,
      inRange,
      comparison: `${timeMinutes} >= ${startMinutes} && ${timeMinutes} <= ${endMinutes}`,
      result: inRange ? '✓ AVAILABLE' : '✗ NOT AVAILABLE'
    });
    
    if (inRange) {
      matchedSlot = slot;
    }
    return inRange;
  });
  
  if (!isAvailable && availability.availabilitySlots.length > 0) {
    console.warn('[Availability] Time not found in any slot', {
      photographerId,
      selectedTime: time,
      time24: normalizedTime24,
      availableSlots: availability.availabilitySlots.map(s => ({
        start: normalizeTime(s.start_time),
        end: normalizeTime(s.end_time),
        rawStart: s.start_time,
        rawEnd: s.end_time
      }))
    });
  }
  
  console.debug('[Availability Result]', {
    photographerId,
    selectedTime: time,
    time24: normalizedTime24,
    isAvailable,
    slotsCount: availability.availabilitySlots.length,
    slotsChecked: availability.availabilitySlots.map(s => ({
      start: normalizeTime(s.start_time),
      end: normalizeTime(s.end_time),
      selectedTime24: normalizedTime24,
      inRange: (() => {
        const [timeH, timeM] = normalizedTime24.split(':').map(Number);
        const [startH, startM] = normalizeTime(s.start_time).split(':').map(Number);
        const [endH, endM] = normalizeTime(s.end_time).split(':').map(Number);
        const timeMin = timeH * 60 + timeM;
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        return timeMin >= startMin && timeMin <= endMin;
      })()
    }))
  });

  // Get next available times (excluding the selected time if it's available)
  const nextTimes = availability.nextAvailableTimes
    .map(normalizeTime)
    .filter((t) => t !== normalizedTime24)
    .slice(0, 3) // Show up to 3 next available times
    .map(to12Hour);

  const result = {
    isAvailable,
    nextAvailableTimes: nextTimes,
  };

  // Create a comprehensive summary log
  const summary = {
    photographerId,
    selectedTime: time,
    time24: normalizedTime24,
    isAvailable,
    slotsFound: availability.availabilitySlots.length,
    slotsChecked: availability.availabilitySlots.map(s => ({
      start: normalizeTime(s.start_time),
      end: normalizeTime(s.end_time),
      rawStart: s.start_time,
      rawEnd: s.end_time,
      status: s.status,
      date: s.date,
      day_of_week: s.day_of_week
    })),
    nextTimes: nextTimes,
    result
  };
  
  // Availability check completed

  return result;
}

/**
 * Get availability overview for multiple photographers
 */
export async function getPhotographersAvailability(
  photographerIds: Array<string | number>,
  date: Date,
  selectedTime: string,
  photographersMap?: Map<string | number, { name: string }>
): Promise<Map<string | number, { isAvailable: boolean; nextAvailableTimes: string[] }>> {
  const results = new Map<
    string | number,
    { isAvailable: boolean; nextAvailableTimes: string[] }
  >();

  console.debug('[getPhotographersAvailability] Starting', {
    photographerIds,
    date: date.toISOString().split('T')[0],
    selectedTime
  });

  await Promise.all(
    photographerIds.map(async (id) => {
      try {
        const photographerName = photographersMap?.get(id)?.name;
        const availability = await checkPhotographerAvailabilityAtTime(
          id,
          date,
          selectedTime,
          photographerName
        );
        // Store with both string and number keys to ensure lookup works
        const idStr = String(id);
        const idNum = typeof id === 'string' ? parseInt(id, 10) : id;
        results.set(id, availability);
        results.set(idStr, availability);
        if (!isNaN(idNum)) {
          results.set(idNum, availability);
        }
        console.debug('[getPhotographersAvailability] Result for photographer', {
          id,
          idStr,
          idNum,
          isAvailable: availability.isAvailable,
          nextTimes: availability.nextAvailableTimes
        });
      } catch (error) {
        console.error('[getPhotographersAvailability] Error for photographer', id, error);
        const idStr = String(id);
        const idNum = typeof id === 'string' ? parseInt(id, 10) : id;
        const errorResult = { isAvailable: false, nextAvailableTimes: [] };
        results.set(id, errorResult);
        results.set(idStr, errorResult);
        if (!isNaN(idNum)) {
          results.set(idNum, errorResult);
        }
      }
    })
  );

  console.debug('[getPhotographersAvailability] Complete', {
    resultsCount: results.size,
    results: Array.from(results.entries()).map(([key, value]) => ({
      key,
      keyType: typeof key,
      isAvailable: value.isAvailable
    }))
  });

  return results;
}


