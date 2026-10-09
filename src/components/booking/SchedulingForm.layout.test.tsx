import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SchedulingForm } from './SchedulingForm';

const state = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/components/auth', () => ({ useAuth: () => ({ user: { role: 'client' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => state.mobile }));
afterEach(() => cleanup());

it.each([false, true])('places the conflict panel after the calendar and before time controls (mobile=%s)', mobile => {
  state.mobile = mobile;
  render(<SchedulingForm date={undefined} setDate={vi.fn()} time="" setTime={vi.fn()}
    formErrors={{}} setFormErrors={vi.fn()} handleSubmit={vi.fn()} goBack={vi.fn()}
    selectedServices={[]} photographers={[]}
    afterCalendar={<section aria-label="Travel feasibility">Conflict details</section>} />);
  const date = screen.getByRole('heading', { name: 'Select Date' });
  const calendar = screen.getByRole('grid');
  const panel = screen.getByRole('region', { name: 'Travel feasibility' });
  const time = screen.getByRole('heading', { name: /^Time$/ });
  expect(date.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(calendar.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(panel.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
