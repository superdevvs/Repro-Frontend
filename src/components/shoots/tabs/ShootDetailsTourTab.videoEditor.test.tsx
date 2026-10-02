import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootDetailsTourTab } from './ShootUnitTourTab';
import { OverviewVideoEmbedsSection } from './overview/OverviewVideoEmbedsSection';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('./tours/TourLinkRow', () => ({ TourLinkRow: ({ label, value, placeholder, actions }) => <div>
  <input aria-label={label} value={value} placeholder={placeholder} readOnly />{actions.map(action => <button key={action.key} onClick={action.onSelect} disabled={action.disabled}>{action.label}</button>)}
</div> }));
vi.mock('./tours/TourProvidersSection', () => ({ TourProvidersSection: () => <div>3D providers</div> }));
const editor = { id: '22', role: 'editor', metadata: { editing_capabilities: ['video'] } };
let nextId = 0;
const makeShoot = (): ShootData => ({ id: `video-${++nextId}`, status: 'editing', services: [],
  serviceItems: [{ id: '5', name: 'Video', price: 100, quantity: 1, video_editor_id: '22', upload_intake_type: 'photo_video' }],
  tourLinks: { property_description: 'Private property copy', matterport_branded: 'https://my.matterport.com/show/?m=abc', video_link: 'https://vimeo.com/123' },
  location: { address: '1 Test Lane' }, client: {}, photographer: {}, payment: {},
} as unknown as ShootData);
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  request = vi.fn(async (_url: string, options: RequestInit) => ({ ok: true, json: async () => ({ data: JSON.parse(String(options.body)) }) }));
  vi.stubGlobal('fetch', request);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('video-only Tours and Overview links', () => {
  it('shows entry placeholders for unsaved versions even when an embed link exists', async () => {
    render(<ShootDetailsTourTab shoot={makeShoot()} isAdmin={false} editorUser={editor} onShootUpdate={vi.fn()} />);
    for (const placeholder of ['Enter branded link', 'Enter MLS link', 'Enter generic link']) {
      expect(screen.getByPlaceholderText(placeholder)).toHaveValue('');
    }
    await waitFor(() => expect(screen.getByLabelText('Video embed')).toHaveValue('https://vimeo.com/123'));
  });

  it.each([
    ['Edit Branded Video', 'video_branded'], ['Edit MLS Video', 'video_mls'],
    ['Edit Generic Video', 'video_generic'], ['Edit video embed', 'video_link'],
  ])('lets assigned video editors save %s without submitting unrelated tour fields', async (button, key) => {
    const shoot = makeShoot();
    render(<ShootDetailsTourTab shoot={shoot} isAdmin={false} editorUser={editor} onShootUpdate={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Video Links' })).toBeInTheDocument();
    for (const label of ['Tour Links', '3D providers', 'Tour Settings', 'Property Information', 'Analytics']) expect(screen.queryByText(label)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: button }));
    fireEvent.change(screen.getByPlaceholderText('https://www.youtube.com/watch?v=... or https://vimeo.com/...'), { target: { value: 'https://vimeo.com/456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toContain(`/shoots/${shoot.id}`);
    expect(JSON.parse(String(request.mock.calls[0][1].body))).toEqual({ tour_links: { [key]: 'https://vimeo.com/456' } });
  });
  it('keeps unit video edits on their own endpoint and hides links in another editor’s unit', async () => {
    const shoot = makeShoot();
    shoot.units = [{ id: 1, label: '101', kind: 'unit', sqft: 1000, beds: 1, baths: 1, tour_links: { video_link: 'https://vimeo.com/111' } },
      { id: 2, label: '102', kind: 'unit', sqft: 1000, beds: 1, baths: 1, tour_links: { video_link: 'https://vimeo.com/222' } }];
    shoot.service_lines = [{ ...shoot.serviceItems![0], shoot_unit_id: 1 }, { ...shoot.serviceItems![0], shoot_unit_id: 2, video_editor_id: '99' }];
    render(<ShootDetailsTourTab shoot={shoot} isAdmin={false} editorUser={editor} onShootUpdate={vi.fn()} />);
    expect(screen.getByLabelText('Video embed')).toHaveValue('https://vimeo.com/111');
    fireEvent.click(screen.getByRole('button', { name: 'Edit video embed' }));
    fireEvent.change(screen.getByPlaceholderText('https://www.youtube.com/watch?v=... or https://vimeo.com/...'), { target: { value: 'https://vimeo.com/333' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toContain(`/shoots/${shoot.id}/units/1/tour`);
    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.queryByRole('heading', { name: 'Video Links' })).not.toBeInTheDocument();
    expect(screen.getByText('Video links can be edited only for units assigned to you.')).toBeInTheDocument();
  });
  it('renames Overview links and saves a selected unit without changing the building', async () => {
    const shoot = makeShoot();
    render(<OverviewVideoEmbedsSection shoot={shoot} unitId={9} role="editor" canWrite onShootUpdate={vi.fn()} />);
    expect(screen.getByText('Video links')).toBeInTheDocument();
    expect(screen.queryByText('Video Tour Embeds')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Video 1 URL'), { target: { value: 'https://vimeo.com/444' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save links' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toContain(`/shoots/${shoot.id}/units/9/tour`);
    expect(JSON.parse(String(request.mock.calls[0][1].body)).tour_links).toMatchObject({ video_link: 'https://vimeo.com/444' });
    expect(JSON.parse(String(request.mock.calls[0][1].body)).tour_links).not.toHaveProperty('property_description');
  });
});
