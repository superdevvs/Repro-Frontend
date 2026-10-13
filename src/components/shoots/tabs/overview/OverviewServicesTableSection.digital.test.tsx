import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { OverviewServicesTableSection, type OverviewServicesTableSectionProps } from './OverviewServicesTableSection';
import { editorsForServiceLane, serviceEditorLane } from '@/components/shoots/serviceEditorEligibility';

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mobile.value }));
afterEach(cleanup);
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const editors = [
  { id: '8', name: 'Photo Editor', role: 'editor', email: '', editing_capabilities: ['photo'] },
  { id: '9', name: 'Video Editor', role: 'editor', email: '', editing_capabilities: ['video'] },
  { id: '10', name: 'Dual Editor', role: 'editor', email: '', editing_capabilities: ['photo', 'video'] },
];
function options(): OverviewServicesTableSectionProps {
  return {
    isEditMode: true, shoot: { id: '2407' } as ShootData, serviceItems: [],
    servicesList: [
      { id: '1', name: 'HDR Photos', category: 'Photos', photographer_required: true },
      { id: '51', name: 'Green Grass Enhancement', category: 'Digital Enhancements', photographer_required: true, requires_editing: true, editing_lanes: ['photo'] },
      { id: '87', name: 'Virtual staging', category: 'Digital Enhancements', photographer_required: false, requires_editing: true, editing_lanes: ['photo'] },
    ], selectedServiceIds: ['1', '51', '87'], serviceSchedules: {}, effectiveSqft: null,
    editModePhotographerRows: [], perCategoryPhotographers: {}, selectedPhotographerIdEdit: '7',
    resolvePhotographerDetails: () => ({ name: 'Ivan', email: 'photographer@example.test' }),
    toggleServiceSelection: vi.fn(), updateServiceSchedule: vi.fn(), openEditPhotographerPicker: vi.fn(),
    getServiceDisplayPrice: () => '$100', getReadonlyServiceDisplayPrice: () => '$100', formatServiceLabel: () => '',
    serviceDialogOpen: false, setServiceDialogOpen: vi.fn(), serviceModalSearch: '', setServiceModalSearch: vi.fn(),
    servicePanelCategory: 'all', setServicePanelCategory: vi.fn(), panelServices: [],
    isClient: false, isPhotographer: false, isEditor: false, canAssignServiceEditors: true, editorOptions: editors,
  };
}

describe('requirement-aware overview assignments', () => {
  it.each([false, true])('shows digital editor selectors with no inherited photographer (mobile=%s)', async isMobile => {
    mobile.value = isMobile;
    const changed = vi.fn();
    function View() {
      const [ids, setIds] = useState<Record<string, string>>({});
      return <OverviewServicesTableSection {...options()} serviceEditorIds={ids}
        updateServiceEditor={(id, editor) => { changed(id, editor); setIds(current => ({ ...current, [id]: editor })); }} />;
    }
    render(<View />);
    expect(screen.getAllByTestId('photographer-cell')).toHaveLength(1);
    expect(screen.getByTestId('photographer-cell')).toHaveTextContent('Ivan');
    const grass = screen.getByRole('combobox', { name: 'Editor for Green Grass Enhancement' });
    expect(grass).toHaveTextContent('No editor assigned');
    expect(screen.getByRole('combobox', { name: 'Editor for Virtual staging' })).toHaveTextContent('No editor assigned');
    fireEvent.keyDown(grass, { key: 'Enter' });
    const list = await screen.findByRole('listbox');
    expect(within(list).queryByRole('option', { name: 'Video Editor' })).toBeNull();
    fireEvent.click(within(list).getByRole('option', { name: 'Photo Editor' }));
    expect(changed).toHaveBeenLastCalledWith('51', '8');
    expect(grass).toHaveTextContent('Photo Editor');
    fireEvent.keyDown(grass, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('listbox')).getByRole('option', { name: 'No editor assigned' }));
    expect(changed).toHaveBeenLastCalledWith('51', '');
    expect(grass).toHaveTextContent('No editor assigned');
  });
  it('keeps representatives out of editor assignment controls', () => {
    render(<OverviewServicesTableSection {...options()} canAssignServiceEditors={false} />);
    expect(screen.queryByRole('combobox', { name: /Editor for/ })).toBeNull();
    expect(screen.getAllByText('No photographer required')).toHaveLength(2);
  });
  it('uses the server lane and excludes incompatible editor capabilities', () => {
    expect(serviceEditorLane({ editing_lanes: ['photo'], upload_intake_type: 'video' })).toBe('photo');
    expect(serviceEditorLane({ editing_lanes: ['video'] })).toBe('video');
    expect(editorsForServiceLane(editors, 'video').map(editor => editor.id)).toEqual(['9', '10']);
    expect(editorsForServiceLane([{ id: '11', name: 'Legacy', role: 'editor', email: '' }], 'photo')).toHaveLength(1);
    expect(editorsForServiceLane([{ id: '12', name: 'Photographer', role: 'photographer', secondary_roles: ['editor'], email: '', editing_capabilities: ['photo'] }], 'photo')).toHaveLength(0);
  });
});
