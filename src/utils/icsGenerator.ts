/**
 * Utility functions for generating ICS (iCalendar) files
 */

interface CalendarEvent {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  uid?: string;
}

/**
 * Escape special characters in ICS content
 */
function escapeICSValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Format date to ICS format (YYYYMMDDTHHmmssZ)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate a unique ID for calendar events
 */
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@repro-calendar`;
}

/**
 * Generate ICS file content from events
 */
export function generateICS(events: CalendarEvent[]): string {
  const lines: string[] = [];
  
  // ICS Header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Repro//Availability Sync//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  
  // Add each event
  events.forEach((event) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid || generateUID()}`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART:${formatICSDate(event.start)}`);
    lines.push(`DTEND:${formatICSDate(event.end)}`);
    lines.push(`SUMMARY:${escapeICSValue(event.title)}`);
    
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICSValue(event.description)}`);
    }
    
    if (event.location) {
      lines.push(`LOCATION:${escapeICSValue(event.location)}`);
    }
    
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  });
  
  // ICS Footer
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

/**
 * Download ICS file
 */
export function downloadICS(events: CalendarEvent[], filename: string = 'availability.ics'): void {
  const icsContent = generateICS(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar URL
 */
export function generateGoogleCalendarURL(event: CalendarEvent): string {
  const params = new URLSearchParams();
  params.append('action', 'TEMPLATE');
  params.append('text', event.title);
  params.append('dates', `${formatICSDate(event.start).replace(/[-:]/g, '').slice(0, -1)}/${formatICSDate(event.end).replace(/[-:]/g, '').slice(0, -1)}`);
  
  if (event.description) {
    params.append('details', event.description);
  }
  
  if (event.location) {
    params.append('location', event.location);
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate Outlook Calendar URL
 */
export function generateOutlookCalendarURL(event: CalendarEvent): string {
  const params = new URLSearchParams();
  params.append('subject', event.title);
  params.append('startdt', event.start.toISOString());
  params.append('enddt', event.end.toISOString());
  
  if (event.description) {
    params.append('body', event.description);
  }
  
  if (event.location) {
    params.append('location', event.location);
  }
  
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

