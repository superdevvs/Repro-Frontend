import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardShootSummary } from '@/types/dashboard';
import { DashboardFilterChips, DashboardShootFilters } from './DashboardShootFilters';
import { defaultFilters } from './shootsTabsCardUtils';
import { matchesDashboardFilters, matchesDashboardStatus } from './dashboardFilterModel';

afterEach(cleanup);
const options = {
  clientOptions: ['all', 'Alex Client', 'Jamie Client'],
  photographerOptions: [{ id: 1, name: 'Jay Photographer' }, { id: 2, name: 'Lee Photographer' }],
  serviceOptions: [{ key: 'hdr', label: 'HDR Photos' }, { key: 'video', label: 'Video' }],
};
function Harness({ role = 'admin' }: { role?: string }) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const reset = () => { setFilters(defaultFilters); setDraft(defaultFilters); setOpen(false); };
  return <>
    <button onClick={() => { setDraft(filters); setOpen(true); }}>Open filters</button>
    <output aria-label="Applied filters">{JSON.stringify(filters)}</output>
    <DashboardFilterChips {...options} role={role} filters={filters} onChange={setFilters} onReset={reset} />
    <DashboardShootFilters {...options} role={role} open={open} filters={filters} draft={draft} onDraftChange={setDraft}
      onApply={() => { setFilters(draft); setOpen(false); }} onCancel={() => { setDraft(filters); setOpen(false); }} onReset={reset} />
  </>;
}
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
const applied = () => JSON.parse(screen.getByLabelText('Applied filters').textContent || '{}');
const expand = (title: string) => {
  const summary = screen.getByText(title, { selector: 'summary' });
  summary.parentElement?.setAttribute('open', '');
};

describe('dashboard filter panel', () => {
  it.each([
    ['admin', true, true], ['superadmin', true, true], ['salesrep', true, true],
    ['editing_manager', true, true], ['photographer', true, false], ['editor', false, false], ['client', false, false],
  ])('shows only permitted filter groups for %s', (role, clients, assignments) => {
    render(<Harness role={role as string} />); openFilters();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Filter shoots');
    expect(Boolean(screen.queryByText('Client', { selector: 'summary' }))).toBe(clients);
    expect(Boolean(screen.queryByText('Photographer', { selector: 'summary' }))).toBe(assignments);
    if (role === 'client') expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
    if (!clients) expect(screen.queryByText('Alex Client')).not.toBeInTheDocument();
  });

  it('keeps drafts separate, applies filters, removes chips and resets', () => {
    render(<Harness />); openFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Uploaded' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(applied().statuses).toEqual([]);
    openFilters();
    expect(screen.getByRole('button', { name: 'Uploaded' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Uploaded' }));
    fireEvent.change(screen.getByPlaceholderText('City, street, zip'), { target: { value: 'Main Street' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(applied().statuses).toEqual(['uploaded']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Uploaded' }));
    expect(applied().statuses).toEqual([]);
    expect(applied().address).toBe('Main Street');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(applied()).toEqual(defaultFilters);
  });

  it('validates custom dates and clears the range when Any date is selected', () => {
    render(<Harness />); openFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Custom Range' }));
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-27' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-26' } });
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-28' } });
    expect(screen.getByRole('button', { name: 'Apply filters' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Any date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(applied().dateRange).toBeNull();
    expect(applied().customRange).toEqual({ from: '', to: '' });
  });

  it('searches assignments and makes unassigned mutually exclusive with people', () => {
    render(<Harness />); openFilters(); expand('Photographer');
    fireEvent.change(screen.getByLabelText('Search Photographers'), { target: { value: 'Jay' } });
    expect(within(screen.getByRole('group', { name: 'Photographers' })).queryByLabelText('Lee Photographer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Jay Photographer'));
    fireEvent.click(screen.getByLabelText('Unassigned only'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(applied().unassignedOnly).toBe(true);
    expect(applied().photographerIds).toEqual([]);
    openFilters(); expand('Photographer'); fireEvent.click(screen.getByLabelText('Lee Photographer'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(applied().unassignedOnly).toBe(false);
    expect(applied().photographerIds).toEqual([2]);
  });

  it('searches clients and services without changing applied values until Apply', () => {
    render(<Harness />); openFilters(); expand('Client');
    fireEvent.change(screen.getByLabelText('Search Clients'), { target: { value: 'Jamie' } });
    fireEvent.click(screen.getByLabelText('Jamie Client'));
    expand('Services'); fireEvent.click(screen.getByLabelText('Video'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(applied().client).toBe('Jamie Client'); expect(applied().services).toEqual(['video']);
  });
});

describe('filter matching', () => {
  it.each([['booked', 'scheduled'], ['photos_uploaded', 'uploaded'], ['completed', 'uploaded'], ['qc', 'review'], ['pending_review', 'review'], ['canceled', 'cancelled'], ['hold_on', 'on_hold'], ['admin_verified', 'delivered']])('matches %s under %s', (status, selected) => {
    expect(matchesDashboardStatus(status, [selected])).toBe(true);
    expect(matchesDashboardStatus(status, ['declined'])).toBe(false);
  });
  it('matches property, date and services together and preserves assignment restrictions', () => {
    const shoot = { id: 1, addressLine: '10 Main Street', cityStateZip: 'Closter NJ', workflowStatus: 'photos_uploaded', scheduledLocalDate: '2026-10-27', services: [{ label: 'HDR Photos', type: 'hdr' }], isFlagged: false, photographer: { id: 1, name: 'Jay' } } as DashboardShootSummary;
    const filters = { ...defaultFilters, statuses: ['uploaded'], address: ' main ', services: ['hdr'], dateRange: 'custom' as const, customRange: { from: '2026-10-26', to: '2026-10-28' }, photographerIds: [2] };
    expect(matchesDashboardFilters(shoot, filters, 'admin')).toBe(false);
    expect(matchesDashboardFilters(shoot, filters, 'photographer')).toBe(true);
    expect(matchesDashboardFilters(shoot, { ...filters, services: ['video'] }, 'client')).toBe(false);
  });
});

