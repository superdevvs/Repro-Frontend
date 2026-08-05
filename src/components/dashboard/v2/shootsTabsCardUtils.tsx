import type React from 'react';
import { addDays, endOfWeek, isAfter, isSameDay, isWithinInterval, startOfWeek, startOfDay } from 'date-fns';
import type { DashboardShootSummary } from '@/types/dashboard';
import { Camera, Film, Home, Map as MapIcon, Sparkles } from 'lucide-react';
import { DroneIcon3 } from '@/components/icons/DroneIcon3';
import type { WeatherInfo } from '@/services/weatherService';
import { parseLocalYmd } from '@/utils/shootLocalDate';

export interface ShootsTabsCardProps {
  upcomingShoots: DashboardShootSummary[];
  requestedShoots: DashboardShootSummary[];
  onSelect: (shoot: DashboardShootSummary, weather?: WeatherInfo | null) => void;
  onApprove?: (shoot: DashboardShootSummary) => void;
  onDecline?: (shoot: DashboardShootSummary) => void;
  onModify?: (shoot: DashboardShootSummary) => void;
  onViewInvoice?: (shoot: DashboardShootSummary) => void;
  role?: string;
  mode?: 'default' | 'editing_manager';
  customTabs?: Array<{
    id: string;
    label: string;
    shoots: DashboardShootSummary[];
    emptyStateText?: string;
  }>;
  title?: string;
}

export type TabType = string;

export const STATUS_COLORS: Record<string, string> = {
  // Main statuses with distinct colors
  requested: 'bg-blue-100 text-blue-700 border-blue-300',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  booked: 'bg-blue-100 text-blue-700 border-blue-200', // Alias for scheduled
  uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  editing: 'bg-purple-100 text-purple-700 border-purple-200',
  review: 'bg-orange-100 text-orange-700 border-orange-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  
  // Legacy/alias statuses
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  in_field: 'bg-sky-100 text-sky-700 border-sky-200',
  uploading: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  photos_uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  raw_uploaded: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  completed: 'bg-indigo-100 text-indigo-700 border-indigo-200', // Maps to uploaded
  qc: 'bg-orange-100 text-orange-700 border-orange-200',
  pending_review: 'bg-orange-100 text-orange-700 border-orange-200',
  ready: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ready_for_client: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  admin_verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  
  // Other statuses
  declined: 'bg-red-100 text-red-700 border-red-200',
  canceled: 'bg-gray-100 text-gray-700 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
  on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
};

export const STATUS_FILTERS = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Field', value: 'in_field' },
  { label: 'Uploading', value: 'uploading' },
  { label: 'Editing', value: 'editing' },
  { label: 'QC', value: 'qc' },
  { label: 'Ready', value: 'ready' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Canceled', value: 'canceled' },
] as const;

export const DATE_RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'Next 7 Days', value: 'next7' },
  { label: 'This Week', value: 'week' },
  { label: 'Custom Range', value: 'custom' },
] as const;

export type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]['value'];

export const SERVICE_LABELS: Record<string, string> = {
  hdr: 'HDR Photos',
  hdr_photos: 'HDR Photos',
  hdr_photo: 'HDR Photos',
  drone: 'Drone Shots',
  drone_shots: 'Drone Shots',
  floorplan: 'Floorplan',
  hd_video: 'HD Video',
  matterport: 'Matterport 3D',
  matterport_3d: 'Matterport 3D',
  virtual_tour: 'Virtual Tour',
  twilight: 'Twilight',
  social_media: 'Social Media Reels',
  iguide: 'iGuide',
  iguide_zip_file: 'iGuide',
};

export type FiltersState = {
  statuses: string[];
  client: string;
  address: string;
  photographerIds: number[];
  unassignedOnly: boolean;
  services: string[];
  dateRange: DateRangeValue | null;
  customRange: { from: string; to: string };
  flaggedOnly: boolean;
  priority: {
    highPriority: boolean;
    missingRaw: boolean;
    missingEditor: boolean;
  };
};

export const defaultFilters: FiltersState = {
  statuses: [],
  client: 'all',
  address: '',
  photographerIds: [],
  unassignedOnly: false,
  services: [],
  dateRange: null,
  customRange: { from: '', to: '' },
  flaggedOnly: false,
  priority: {
    highPriority: false,
    missingRaw: false,
    missingEditor: false,
  },
};

export const parseShootDate = (shoot: DashboardShootSummary) =>
  shoot.startTime ? new Date(shoot.startTime) : null;

// Local-day Date for DISPLAY (month/day/weekday tiles). Sourced from the shoot's
// intended local calendar day so it never drifts across browser timezones; the
// absolute `startTime` instant is only a fallback / used for sorting.
export const getSummaryLocalDate = (shoot: DashboardShootSummary): Date | null => {
  if (shoot.scheduledLocalDate) {
    const local = parseLocalYmd(shoot.scheduledLocalDate);
    if (!Number.isNaN(local.getTime())) return local;
  }
  return shoot.startTime ? new Date(shoot.startTime) : null;
};

export const matchesDateRange = (shoot: DashboardShootSummary, filters: FiltersState) => {
  if (!filters.dateRange) return true;
  const shootDate = parseShootDate(shoot);
  if (!shootDate) return false;
  const today = new Date();

  switch (filters.dateRange) {
    case 'today':
      return isSameDay(shootDate, today);
    case 'tomorrow':
      return isSameDay(shootDate, addDays(today, 1));
    case 'next7':
      return isWithinInterval(shootDate, { start: today, end: addDays(today, 7) });
    case 'week':
      return isWithinInterval(shootDate, {
        start: startOfWeek(today, { weekStartsOn: 0 }),
        end: endOfWeek(today, { weekStartsOn: 0 }),
      });
    case 'custom': {
      const { from, to } = filters.customRange;
      if (!from && !to) return true;
      const start = from ? new Date(from) : undefined;
      const end = to ? new Date(to) : undefined;
      if (start && end) return isWithinInterval(shootDate, { start, end });
      if (start) return isAfter(shootDate, start) || isSameDay(shootDate, start);
      if (end) return isAfter(end, shootDate) || isSameDay(shootDate, end);
      return true;
    }
    default:
      return true;
  }
};

export const getServiceKey = (label: string, type?: string) => type || label.toLowerCase().replace(/\s+/g, '_');

export const SERVICE_ICON_MAP: Record<string, React.ReactNode> = {
  hdr: <Camera size={12} />,
  hdr_photos: <Camera size={12} />,
  hdr_photo: <Camera size={12} />,
  drone: <DroneIcon3 className="w-3 h-3" />,
  drone_shots: <DroneIcon3 className="w-3 h-3" />,
  floorplan: <MapIcon size={12} />,
  floor_plan: <MapIcon size={12} />,
  hd_video: <Film size={12} />,
  matterport: <Home size={12} />,
  matterport_3d: <Home size={12} />,
  virtual_tour: <Home size={12} />,
  twilight: <Sparkles size={12} />,
  social_media: <Film size={12} />,
};

export const countActiveFilters = (filters: FiltersState) => {
  let count = 0;
  if (filters.statuses.length) count += 1;
  if (filters.client !== 'all') count += 1;
  if (filters.address) count += 1;
  if (filters.photographerIds.length) count += 1;
  if (filters.unassignedOnly) count += 1;
  if (filters.services.length) count += 1;
  if (filters.dateRange || filters.customRange.from || filters.customRange.to) count += 1;
  if (filters.flaggedOnly) count += 1;
  if (filters.priority.highPriority) count += 1;
  if (filters.priority.missingRaw) count += 1;
  if (filters.priority.missingEditor) count += 1;
  return count;
};

export const isShootInPast = (shoot: DashboardShootSummary) => {
  if (!shoot.startTime) return false;
  const shootDate = new Date(shoot.startTime);
  const today = startOfDay(new Date());
  return !isSameDay(shootDate, today) && !isAfter(shootDate, today);
};


