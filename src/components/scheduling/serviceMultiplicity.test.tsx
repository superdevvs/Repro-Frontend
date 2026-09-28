import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { ServiceCard } from './ServiceCard';
import { ServiceCreateDialog, type ServiceDraft } from './ServiceCreateDialog';

vi.mock('axios', () => ({ default: { put: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/settings/CategorySelect', () => ({ CategorySelect: () => null }));
vi.mock('./IconPicker', () => ({ IconPicker: () => null, getIconComponent: () => () => null }));

const draft: ServiceDraft = {
  name: '5 Elevated Photos', description: 'Elevated photos', price: '150', pricing_type: 'fixed',
  allow_multiple: false, delivery_time: '24', category: 'Photos', icon: 'Camera',
  photographer_required: false, photographer_pay: '', photographer_pay_type: 'fixed',
  photographer_pay_percent: '', exclude_from_sales_commission: false, photo_count: 5, service_group_ids: [],
};

function CreateService({ onSave }: { onSave: (value: ServiceDraft) => void }) {
  const [value, setValue] = useState(draft);
  return <ServiceCreateDialog open onOpenChange={vi.fn()} newService={value} setNewService={setValue}
    newSqftRanges={[]} setNewSqftRanges={vi.fn()} isNewServicePhotoCategory
    serviceGroupOptions={[]} onSave={() => onSave(value)} />;
}

describe('Scheduling service multiplicity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('authToken', 'test-session');
    vi.mocked(axios.put).mockResolvedValue({ data: {} });
  });

  it('defaults new services to one item and lets an admin enable multiples', () => {
    const save = vi.fn();
    render(<CreateService onSave={save} />);
    const toggle = screen.getByRole('switch', { name: 'Allow multiple' });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /save service/i }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ allow_multiple: true, photo_count: 5 }));
  });

  it.each([false, true])('persists changing an existing service from allow_multiple=%s', async (enabled) => {
    render(<ServiceCard service={{ ...draft, id: '7', active: true, allow_multiple: enabled }}
      availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('switch', { name: 'Allow multiple' })).toHaveAttribute('aria-checked', String(enabled));
    fireEvent.click(screen.getByRole('switch', { name: 'Allow multiple' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/admin/services/7'),
      expect.objectContaining({ allow_multiple: !enabled, photo_count: 5 }), expect.any(Object)));
  });
});
