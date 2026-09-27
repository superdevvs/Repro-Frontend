import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData, ShootUnit } from '@/types/shoots';
import { useShootTourPropertyEditor } from './useShootTourPropertyEditor';

const selection = vi.hoisted(() => ({ unit: null as ShootUnit | null }));
vi.mock('@/features/shoot-units/useShootUnitScope', () => ({ useShootUnitScope: () => ({ unit: selection.unit, isMultiUnit: true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('./ShootDetailsTourTab', () => ({
  ShootDetailsTourContent: (props: { shoot: ShootData; unitId: number; onShootUpdate: () => void }) => {
    const empty = React.useMemo(() => ({}), []);
    const editor = useShootTourPropertyEditor({ ...props, isAdmin: true, sourceTourLinks: props.shoot.tourLinks ?? empty, sourcePropertyDetails: empty, normalizedPropertyDetails: empty });
    return <><input aria-label="Description draft" value={editor.propertyDescription} onChange={event => editor.setPropertyDescription(event.target.value)} /><button onClick={() => void editor.handleSaveDescription()}>Save description</button></>;
  },
}));
import { ShootDetailsTourTab } from './ShootUnitTourTab';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('switching units in Tours', () => {
  it('shows a release message for a pending client unit and exposes its ready sibling', () => {
    const unit = { id: 14, label: 'Unreleased', kind: 'unit', beds: 1, baths: 1, sqft: 700, ready_service_count: 0 } as ShootUnit;
    const shoot = { id: 8, units: [unit], services: [] } as unknown as ShootData;
    const props = { shoot, isAdmin: false, isClient: true, isClientReleaseLocked: true, onShootUpdate: vi.fn() };
    selection.unit = unit;
    const rendered = render(<ShootDetailsTourTab {...props} />);
    expect(screen.queryByLabelText('Description draft')).toBeNull();
    expect(screen.getByText('Unreleased tour is not released yet')).toBeTruthy();
    selection.unit = { ...unit, id: 15, label: 'Released', ready_service_count: 1 };
    rendered.rerender(<ShootDetailsTourTab {...props} />);
    expect(screen.getByLabelText('Description draft')).toBeTruthy();
  });
  it('resets drafts and keeps a pending save on its original unit', async () => {
    const first = { id: 11, label: '101', kind: 'unit', beds: 1, baths: 1, sqft: 700, tour_links: { property_description: 'First' } } as ShootUnit;
    const second = { ...first, id: 12, label: '102', tour_links: { property_description: 'Second' } };
    const shoot = { id: 7, units: [first, second], services: [] } as unknown as ShootData;
    let completeSave: (response: Response) => void = () => {};
    const request = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(resolve => { completeSave = resolve; }));
    vi.stubGlobal('fetch', request);
    selection.unit = first;
    const props = { shoot, isAdmin: true, onShootUpdate: vi.fn() };
    const rendered = render(<ShootDetailsTourTab {...props} />);
    fireEvent.change(screen.getByLabelText('Description draft'), { target: { value: 'First changed' } });
    fireEvent.click(screen.getByText('Save description'));
    expect(request.mock.calls[0][0]).toContain('/shoots/7/units/11/tour');
    selection.unit = second;
    rendered.rerender(<ShootDetailsTourTab {...props} />);
    expect((screen.getByLabelText('Description draft') as HTMLInputElement).value).toBe('Second');
    await act(async () => { completeSave(Response.json({ data: first })); });
    expect((screen.getByLabelText('Description draft') as HTMLInputElement).value).toBe('Second');
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(request.mock.calls[0][1].body))).toEqual({ tour_links: { property_description: 'First changed' } });
  });
});
