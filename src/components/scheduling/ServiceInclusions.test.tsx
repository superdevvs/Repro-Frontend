import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
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

function addPreset(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add a service' }));
  fireEvent.click(screen.getByRole('button', { name }));
}

function Editor({ initial = [] }: { initial?: ServiceInclusion[] }) {
  const [value, setValue] = useState(initial);
  return <ServiceInclusionsEditor value={value} onChange={setValue} />;
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
    addPreset('HDR Photos');
    addPreset('Basic Social Video');
    addPreset('Zillow 3D with Floor Plans');
    expect(screen.getByRole('status', { name: 'Upload summary' })).toHaveTextContent('Photos and videos');
    expect(screen.queryByRole('switch', { name: 'Combine shots (HDR)' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Service' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ included_components: INCLUSION_PRESETS.slice(0, 3), photo_count: 35 }));
  });

  it('loads, edits and persists inclusions on existing packages while preserving price and photo count', async () => {
    render(<ServiceCard service={{ ...draft, id: '85', active: true, upload_intake_type: 'photo_video',
      included_components: INCLUSION_PRESETS.slice(0, 3) }} availableServiceGroups={[]} onUpdate={vi.fn()} />);
    expect(screen.getByText('Basic Social Video')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Service 2'), { target: { value: 'One-minute Social Video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/admin/services/85'),
      expect.objectContaining({ price: 450, photo_count: 35, included_components: [INCLUSION_PRESETS[0],
        { ...INCLUSION_PRESETS[1], name: 'One-minute Social Video' }, INCLUSION_PRESETS[2]] }), expect.any(Object)));
  });

  it('removing video changes the preview, and cancel/reopen restores the saved package', () => {
    render(<ServiceCard service={{ ...draft, id: '85', active: true, upload_intake_type: 'photo_video',
      included_components: INCLUSION_PRESETS.slice(0, 3) }} availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove service 2' }));
    expect(screen.getByRole('status', { name: 'Upload summary' })).toHaveTextContent(/^Photographer uploads: Photos$/);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Service 2')).toHaveValue('Basic Social Video');
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('keeps unmarked legacy permissions when saving an unrelated field', async () => {
    render(<ServiceCard service={{ ...draft, included_components: null, id: '7', active: true, upload_intake_type: 'photo' }}
      availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('status', { name: 'Upload summary' })).toHaveTextContent('Photographer uploads: Photos');
    expect(screen.getByText('Using the current settings. Add the included services to change them.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ included_components: undefined }), expect.any(Object)));
  });

  it('blocks empty or duplicate component names before submitting', () => {
    render(<ServiceCard service={{ ...draft, id: '85', active: true, included_components: INCLUSION_PRESETS.slice(0, 2) }}
      availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Service 2'), { target: { value: ' HDR PHOTOS ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(axios.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Service 2'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('tour-only inclusions do not turn on camera uploads', () => {
    render(<Editor />);
    addPreset('Zillow 3D with Floor Plans');
    expect(screen.getByRole('status', { name: 'Upload summary' })).toHaveTextContent('No photos or videos');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(inclusionCapabilities([INCLUSION_PRESETS[2]])).toEqual({ upload_intake_type: 'none', uses_hdr_brackets: false });
  });

  it('saves photo and video checkboxes without resetting the existing hidden HDR setting', async () => {
    render(<ServiceCard service={{ ...draft, id: '85', active: true, included_components: [INCLUSION_PRESETS[0]] }}
      availableServiceGroups={[]} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Videos' }));
    expect(screen.getByRole('checkbox', { name: 'Photos' })).toBeChecked();
    expect(screen.getByRole('status', { name: 'Upload summary' })).toHaveTextContent('Photos and videos');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      included_components: [{ ...INCLUSION_PRESETS[0], upload_intake_type: 'photo_video', uses_hdr_brackets: true }],
    }), expect.any(Object)));
  });

  it('clears HDR only when photos are disabled and supports video-only or no uploads', () => {
    render(<Editor initial={[INCLUSION_PRESETS[0]]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Videos' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Photos' }));
    expect(screen.getByRole('status', { name: 'Upload summary' })).toHaveTextContent(/^Photographer uploads: Videos$/);
    expect(screen.queryByRole('button', { name: 'Photo options' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Videos' }));
    expect(screen.getByRole('status', { name: 'Upload summary' })).toHaveTextContent('No photos or videos');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Photo options' }));
    expect(screen.getByRole('switch', { name: 'Combine shots (HDR)' })).not.toBeChecked();
  });

  it('opens choices and photo options with a keyboard, focuses added services and keeps options on reopen', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    expect(screen.queryByRole('button', { name: 'HDR Photos' })).not.toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: 'Add a service' });
    addButton.focus();
    await user.keyboard('{Enter}');
    expect(addButton).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'HDR Photos' }));
    expect(addButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Service 1')).toHaveFocus();
    const options = screen.getByRole('button', { name: 'Photo options' });
    options.focus();
    await user.keyboard('{Enter}');
    const hdr = screen.getByRole('switch', { name: 'Combine shots (HDR)' });
    expect(hdr).toBeChecked();
    expect(hdr).toHaveAccessibleDescription(/different brightness levels/);
    await user.click(hdr);
    options.focus();
    await user.keyboard('{Enter}{Enter}');
    expect(screen.getByRole('switch', { name: 'Combine shots (HDR)' })).not.toBeChecked();
  });
});
