import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { ServiceCard } from './ServiceCard';
import { ServiceCreateDialog, type ServiceDraft } from './ServiceCreateDialog';
import { ServiceInclusionsEditor } from './ServiceInclusionsEditor';
import { inclusionCapabilities, INCLUSION_PRESETS, type ServiceInclusion } from './serviceInclusions';

vi.mock('axios', () => ({ default: { put: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/settings/CategorySelect', () => ({ CategorySelect: () => null }));
vi.mock('./IconPicker', () => ({ IconPicker: () => null, getIconComponent: () => () => null }));

const draft: ServiceDraft = {
  name: 'Showcase Premium', description: '', price: '450', pricing_type: 'fixed', allow_multiple: false,
  delivery_time: '24', category: 'Packages', icon: 'Camera', photographer_required: true,
  photographer_pay: '100', photographer_pay_type: 'fixed', photographer_pay_percent: '',
  exclude_from_sales_commission: false, photo_count: 35, service_group_ids: [], included_components: [],
};

function Create({ save }: { save: (value: ServiceDraft) => void }) {
  const [value, setValue] = useState(draft);
  return <ServiceCreateDialog open onOpenChange={vi.fn()} newService={value} setNewService={setValue}
    newSqftRanges={[]} setNewSqftRanges={vi.fn()} isNewServicePhotoCategory serviceGroupOptions={[]} onSave={() => save(value)} />;
}

describe('Scheduling package inclusions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('authToken', 'test-session');
    vi.mocked(axios.put).mockResolvedValue({ data: {} });
  });

  it('builds a photo/video/tour package and shows the resulting upload permissions', () => {
    const save = vi.fn();
    render(<Create save={save} />);
    fireEvent.click(screen.getByRole('button', { name: '+ HDR Photos' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Basic Social Video' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Zillow 3D with Floor Plans' }));
    expect(screen.getByRole('status', { name: 'Enabled uploads' })).toHaveTextContent('Photo & video uploads');
    expect(screen.getByRole('switch', { name: 'HDR brackets for inclusion 1' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ included_components: INCLUSION_PRESETS.slice(0, 3), photo_count: 35 }));
  });

  it('loads, edits and persists inclusions on existing packages while preserving price and photo count', async () => {
    render(<ServiceCard service={{ ...draft, id: '85', active: true, upload_intake_type: 'photo_video',
      included_components: INCLUSION_PRESETS.slice(0, 3) }} availableServiceGroups={[]} onUpdate={vi.fn()} />);
    expect(screen.getByText('Basic Social Video')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Inclusion 2'), { target: { value: 'One-minute Social Video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/admin/services/85'),
      expect.objectContaining({ price: 450, photo_count: 35, included_components: [INCLUSION_PRESETS[0],
        { ...INCLUSION_PRESETS[1], name: 'One-minute Social Video' }, INCLUSION_PRESETS[2]] }), expect.any(Object)));
  });

  it('removing video changes the preview, and cancel/reopen restores the saved package', () => {
    render(<ServiceCard service={{ ...draft, id: '85', active: true, upload_intake_type: 'photo_video',
      included_components: INCLUSION_PRESETS.slice(0, 3) }} availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove inclusion 2' }));
    expect(screen.getByRole('status', { name: 'Enabled uploads' })).toHaveTextContent(/^Photo uploads$/);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Inclusion 2')).toHaveValue('Basic Social Video');
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('keeps unmarked legacy permissions when saving an unrelated field', async () => {
    render(<ServiceCard service={{ ...draft, included_components: null, id: '7', active: true, upload_intake_type: 'photo' }}
      availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('status', { name: 'Enabled uploads' })).toHaveTextContent('Photo uploads · inclusions not marked yet');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ included_components: undefined }), expect.any(Object)));
  });

  it('blocks empty or duplicate component names before submitting', () => {
    render(<ServiceCard service={{ ...draft, id: '85', active: true, included_components: INCLUSION_PRESETS.slice(0, 2) }}
      availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Inclusion 2'), { target: { value: ' HDR PHOTOS ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(axios.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Inclusion 2'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('tour-only inclusions do not turn on camera uploads', () => {
    function TourOnly() {
      const [value, setValue] = useState<ServiceInclusion[]>([]);
      return <ServiceInclusionsEditor value={value} onChange={setValue} />;
    }
    render(<TourOnly />);
    fireEvent.click(screen.getByRole('button', { name: '+ Zillow 3D with Floor Plans' }));
    expect(screen.getByRole('status', { name: 'Enabled uploads' })).toHaveTextContent('No camera uploads');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(inclusionCapabilities([INCLUSION_PRESETS[2]])).toEqual({ upload_intake_type: 'none', uses_hdr_brackets: false });
  });
});
