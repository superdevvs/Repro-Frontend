import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewForm } from './ReviewForm';
import { calculatePricingBreakdown } from '@/utils/pricing';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
afterEach(cleanup);

describe('booking confirmation quantities', () => {
  it('shows the same counts and complete line totals as the submitted booking', () => {
    const changeNotifications = vi.fn();
    render(<ReviewForm
      client="1" address="10 Test Lane" city="Test City" state="VA" zip="22030"
      bedrooms={2} bathrooms={1} sqft={1000} area={1000} date={new Date('2026-10-10T12:00:00')}
      time="10:00 AM" photographer="" setPhotographer={vi.fn()} photographers={[]}
      selectedServices={[
        { id: '7', name: 'Photos', description: '', price: 90, quantity: 3, photographer_required: false },
        { id: '8', name: 'Floorplans', description: '', price: 250, total_price: 250, quantity: 4, photographer_required: false },
      ]}
      additionalNotes="" setAdditionalNotes={vi.fn()} bypassPayment setBypassPayment={vi.fn()}
      sendNotification={false} setSendNotification={vi.fn()} packagePrice={520}
      notificationControls={{ value: { client: false, photographer: true }, onChange: changeNotifications }}
      pricing={calculatePricingBreakdown({ serviceSubtotal: 520, taxRate: 0 })}
      photographerRate={0} onConfirm={vi.fn()} onBack={vi.fn()}
    />);
    expect(within(screen.getByText('Photos × 3').closest('li')!).getByText('$270.00')).toBeInTheDocument();
    expect(within(screen.getByText('Floorplans × 4').closest('li')!).getByText('$250.00')).toBeInTheDocument();
    expect(screen.queryByText('$1000.00')).toBeNull();
    expect(screen.queryByText('Notify client and photographer')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Notify client' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Notify photographer' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Notify client' }));
    expect(changeNotifications).toHaveBeenCalledWith({ client: true, photographer: true });
  });
});
