import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ShootData } from '@/types/shoots';

const mocks = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: (resource: string, action: string) => resource === 'payments' && action === 'mark-paid' && mocks.allowed }) }));
vi.mock('@/features/shoot-units/useUnitAssignmentPayload', () => ({ useUnitAssignmentPayload: () => vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/payments/MarkAsPaidDialog', () => ({ MarkAsPaidDialog: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div>Manual payment form</div> : null }));
import { ShootDetailsQuickActions } from './ShootDetailsQuickActions';

afterEach(cleanup);
const shoot = { id: '1', payment: { totalQuote: 200, totalPaid: 0 } } as ShootData;
const show = (paid = false) => render(<ShootDetailsQuickActions shoot={paid ? { ...shoot, payment: { ...shoot.payment, totalPaid: 200 } } : shoot} role="admin" isAdmin isPhotographer={false} isEditor={false} isClient={false} onShootUpdate={vi.fn()} />);

describe('shoot manual payment permission', () => {
  it('lets an allowed admin open the manual payment form', () => {
    mocks.allowed = true;
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Paid' }));
    expect(screen.getByText('Manual payment form')).toBeInTheDocument();
  });
  it('hides the action when denied even for an admin', () => {
    mocks.allowed = false;
    show();
    expect(screen.queryByRole('button', { name: 'Mark as Paid' })).not.toBeInTheDocument();
  });
  it('does not offer another payment on a settled shoot', () => {
    mocks.allowed = true;
    show(true);
    expect(screen.queryByRole('button', { name: 'Mark as Paid' })).not.toBeInTheDocument();
  });
});
