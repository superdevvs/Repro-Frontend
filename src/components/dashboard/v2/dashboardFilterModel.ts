import type { DashboardShootSummary } from '@/types/dashboard';
import { formatWorkflowStatus } from '@/utils/status';
import { canFilterByPhotographer, normalizeDashboardRole } from '@/utils/dashboardFilterPermissions';
import { defaultFilters, getServiceKey, matchesDateRange, type FiltersState } from './shootsTabsCardUtils';

export const dashboardStatusOptions = [
  ['requested', 'Requested'], ['scheduled', 'Scheduled'], ['confirmed', 'Confirmed'],
  ['in_field', 'In field'], ['uploading', 'Uploading'], ['uploaded', 'Uploaded'],
  ['editing', 'Editing'], ['review', 'Review'], ['ready', 'Ready'],
  ['delivered', 'Delivered'], ['on_hold', 'On hold'], ['cancelled', 'Cancelled'], ['declined', 'Declined'],
].map(([value, label]) => ({ value, label }));

// Match the labels already used on shoot cards, including historical API values.
export function matchesDashboardStatus(status: string, selected: string[]) {
  return !selected.length || selected.some(value => formatWorkflowStatus(value) === formatWorkflowStatus(status));
}

export function matchesDashboardFilters(shoot: DashboardShootSummary, filters: FiltersState, role?: string) {
  if (!matchesDashboardStatus(shoot.workflowStatus || shoot.status || '', filters.statuses)) return false;
  if (filters.client !== 'all' && (shoot.clientName || '').toLowerCase() !== filters.client.toLowerCase()) return false;
  const address = filters.address.trim().toLowerCase();
  if (address && !`${shoot.addressLine} ${shoot.cityStateZip}`.toLowerCase().includes(address)) return false;
  if (canFilterByPhotographer(role)) {
    if (filters.photographerIds.length && (!shoot.photographer || !filters.photographerIds.includes(shoot.photographer.id))) return false;
    if (filters.unassignedOnly && shoot.photographer) return false;
  }
  if (filters.services.length && !shoot.services.some(service => filters.services.includes(getServiceKey(service.label, service.type)))) return false;
  if ((filters.flaggedOnly || filters.priority.highPriority) && !shoot.isFlagged) return false;
  const note = shoot.adminIssueNotes?.toLowerCase() || '';
  if (filters.priority.missingRaw && !note.includes('raw')) return false;
  if (filters.priority.missingEditor && !note.includes('editor')) return false;
  return matchesDateRange(shoot, filters);
}

export function dashboardFilterVisibility(role?: string) {
  const normalized = normalizeDashboardRole(role);
  return {
    clients: !['client', 'editor', 'photo_editor', 'video_editor'].includes(normalized),
    assignments: canFilterByPhotographer(role),
    priority: normalized !== 'client',
  };
}

export function clearDashboardFilter(filters: FiltersState, key: string): FiltersState {
  if (key.startsWith('status:')) return { ...filters, statuses: filters.statuses.filter(value => value !== key.slice(7)) };
  if (key.startsWith('service:')) return { ...filters, services: filters.services.filter(value => value !== key.slice(8)) };
  if (key.startsWith('photographer:')) return { ...filters, photographerIds: filters.photographerIds.filter(value => value !== Number(key.slice(13))) };
  if (key.startsWith('priority:')) return { ...filters, priority: { ...filters.priority, [key.slice(9)]: false } };
  if (key === 'dateRange') return { ...filters, dateRange: null, customRange: { from: '', to: '' } };
  return { ...filters, [key]: defaultFilters[key as keyof FiltersState] };
}
