import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MediaFile } from '@/hooks/useShootFiles';
import type { AssignmentPreview, DeliveryPlan } from '@/services/mediaMarkService';
import { MediaMarkDialog } from './MediaMarkDialog';

const mocks = vi.hoisted(() => ({ role: 'editing_manager', plan: vi.fn(), preview: vi.fn(), assign: vi.fn(), finalize: vi.fn(), refresh: vi.fn(), toast: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: mocks.role, user: { id: '5', role: mocks.role } }) }));
vi.mock('@/hooks/useShootMutationRefresh', () => ({ useShootMutationRefresh: () => mocks.refresh }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/mediaMarkService', async original => ({ ...await original<object>(), getDeliveryPlan: mocks.plan, previewServiceAssignment: mocks.preview, applyServiceAssignment: mocks.assign }));
vi.mock('../../../finalize/finalizeShootWithProgressToast', () => ({ finalizeShootWithProgressToast: mocks.finalize }));
const file = { id: '21', filename: 'front.jpg', fileSize: 12345, shoot_service_id: null, content_version: 2, can_interact: true } as MediaFile;
const component = (id: string, kind: 'photo' | 'video' | 'floorplan', status: 'pending' | 'ready' | 'delivered') => ({ id, kind, label: kind === 'photo' ? 'Photos' : kind === 'video' ? 'Video' : 'Floorplans', service_name: 'Showcase', shoot_service_id: 6117, unit_id: null, status, required: true, resolved: status === 'delivered', file_ids: status === 'ready' ? [21] : [], output_count: status === 'ready' ? 63 : 0, reason_codes: status === 'pending' ? ['missing_video'] : [], reason: status === 'pending' ? 'Finished video is missing.' : null, methods: (status === 'ready' ? ['media', 'defer'] : ['defer']) as ('media' | 'defer')[] });
const plan = (): DeliveryPlan => ({ revision: 'revision-1', shoot_id: 5935, summary: 'Photos and floorplans ready; video pending.', components: [component('photos', 'photo', 'ready'), component('plans', 'floorplan', 'ready'), component('video', 'video', 'pending'), component('old', 'photo', 'delivered')], ready_component_ids: ['photos', 'plans'], remaining_component_ids: ['photos', 'plans', 'video'], capabilities: { can_finalize: true, can_manual_no_content: true, can_assign_service: true } });
const discovery = (): AssignmentPreview => ({ capabilities: { can_assign_service: true }, targets: [{ id: 6117, service_id: 85, name: 'Showcase', unit_id: 9001, unit_label: 'Unit A', assignee_name: 'Lee', accepted_types: ['photo'] }], files: [{ id: 21, shoot_service_id: null, content_version: 2 }], blockers: [], can_apply: true });
beforeEach(() => { vi.clearAllMocks(); mocks.role = 'editing_manager'; mocks.plan.mockResolvedValue(plan()); mocks.preview.mockResolvedValue(discovery()); mocks.assign.mockResolvedValue({ updated_count: 1 }); mocks.finalize.mockResolvedValue({ status: 'completed', warnings: [] }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const show = (initialTab: 'type' | 'service' | 'delivery' = 'type') => render(<MediaMarkDialog request={{ shootId: 5935, shootLabel: '18013 Highfield Road', files: [file], allowType: true, initialTab }} onClose={vi.fn()} />);

describe('shared media Mark workspace', () => {
  it('changes type without sending a service or delivery mutation', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updated_count: 1 }) }); vi.stubGlobal('fetch', fetch);
    show(); await screen.findByRole('tab', { name: 'Service' }); fireEvent.click(screen.getByRole('radio', { name: 'Drone' })); fireEvent.click(screen.getByRole('button', { name: /Save type/ }));
    await screen.findByText('All set');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ file_ids: [21], media_type: 'drone' });
    expect(mocks.assign).not.toHaveBeenCalled(); expect(mocks.finalize).not.toHaveBeenCalled(); expect(mocks.refresh).toHaveBeenCalledWith(5935);
  });
  it('previews the exact saved file version and target before assigning across unit scopes', async () => {
    show('service'); await screen.findByRole('radio', { name: /Showcase Unit A/ });
    fireEvent.click(screen.getByRole('radio', { name: /Showcase Unit A/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Assign service/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Assign service/ })); await screen.findByText('All set');
    expect(mocks.assign).toHaveBeenCalledWith(5935, expect.objectContaining({ file_ids: [21], shoot_service_id: 6117, expected_target_unit_id: 9001, expected_files: discovery().files, idempotency_key: expect.any(String), confirm_historical: false }));
  });
  it('finalizes ready components only while explaining the pending video', async () => {
    show('delivery'); await screen.findByText('Finished video is missing.');
    expect(screen.getByRole('checkbox', { name: 'Select Video — Showcase' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select Floorplans — Showcase' })).toBeChecked();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finalise' })); await screen.findByText('All set');
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ component_ids: ['photos', 'plans'], mode: 'auto', allow_without_content: false, confirmed: true, plan_revision: 'revision-1' }) }));
  });
  it('keeps missing work pending with a meaningful reason while preserving real ready outputs', async () => {
    show('delivery'); await screen.findByText('Finished video is missing.');
    fireEvent.click(screen.getByRole('switch', { name: 'Finalise without waiting' }));
    const apply = screen.getByRole('button', { name: 'Finalise' });
    expect(screen.getByRole('checkbox', { name: 'Select Video — Showcase' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Video — Showcase' }));
    expect(apply).toBeDisabled();
    expect(screen.getByText('Pending — deliver when ready')).toBeInTheDocument();
    expect(screen.getByText(/will stay pending/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /Reason for proceeding/ }), { target: { value: 'Approved external handoff' } });
    expect(apply).toBeEnabled();
    fireEvent.click(apply); await screen.findByText('All set');
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ component_ids: ['photos', 'plans', 'video'], mode: 'auto', allow_without_content: true, reason: 'Approved external handoff', confirmed: true }) }));
  });
  it.each(['editor', 'photographer', 'salesrep', 'client'])('does not fetch or expose staff controls to %s', async role => {
    mocks.role = role; show(); expect(screen.queryByRole('tab', { name: 'Service' })).not.toBeInTheDocument(); expect(screen.queryByRole('tab', { name: 'Delivery' })).not.toBeInTheDocument(); expect(mocks.plan).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it('honors denied server capabilities even for an admin', async () => {
    mocks.role = 'admin'; mocks.plan.mockResolvedValue({ ...plan(), capabilities: { can_finalize: false, can_manual_no_content: false, can_assign_service: false } }); mocks.preview.mockResolvedValue({ ...discovery(), capabilities: { can_assign_service: false } });
    show('delivery'); await screen.findByText('This action is unavailable'); expect(screen.queryByRole('tab', { name: 'Service' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Finalise' })).toBeDisabled();
  });
  it('supports keyboard navigation between the shared tabs', async () => {
    show(); await screen.findByRole('tab', { name: 'Service' });
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Type' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Service' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Service' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Service' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Delivery' })).toHaveAttribute('aria-selected', 'true');
  });
  it('selects ready external output together with photos without a delivery-mode picker', async () => {
    mocks.plan.mockResolvedValue({ ...plan(), components: [component('photos', 'photo', 'ready'),
      { ...component('tour', 'floorplan', 'ready'), label: 'Property tour', kind: 'tour', file_ids: [], methods: ['external', 'manual_no_content'], external_url: 'https://youriguide.com/ready' }] });
    render(<MediaMarkDialog request={{ shootId: 5935, initialTab: 'delivery' }} onClose={vi.fn()} />);
    await screen.findByRole('link', { name: /Review/ });
    fireEvent.click(screen.getByRole('button', { name: 'Finalise' })); await screen.findByText('All set');
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ component_ids: ['photos', 'tour'], mode: 'auto', confirmed: true }) }));
  });
  it('turning off without-content removes pending selections and retains ready work', async () => {
    show('delivery'); await screen.findByText('Finished video is missing.');
    fireEvent.click(screen.getByRole('switch', { name: 'Finalise without waiting' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Video — Showcase' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Finalise without waiting' }));
    expect(screen.getByRole('checkbox', { name: 'Select Video — Showcase' })).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: /Reason for proceeding/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Finalise' })); await screen.findByText('All set');
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ component_ids: ['photos', 'plans'], allow_without_content: false }) }));
  });
  it('does not ask staff to finalise the same deferred floorplan again', async () => {
    mocks.plan.mockResolvedValue({ ...plan(), components: [component('photos', 'photo', 'delivered'), { ...component('plans', 'floorplan', 'pending'), deferred: true }] });
    render(<MediaMarkDialog request={{ shootId: 5935, initialTab: 'delivery' }} onClose={vi.fn()} />);
    await screen.findByText('Pending — deliver when ready');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalise' })).toBeDisabled();
  });
  it('offers newly ready content even when its earlier deferral is still recorded', async () => {
    mocks.plan.mockResolvedValue({ ...plan(), components: [{ ...component('plans', 'floorplan', 'ready'), deferred: true }] });
    render(<MediaMarkDialog request={{ shootId: 5935, initialTab: 'delivery' }} onClose={vi.fn()} />);
    await screen.findByText('63 files ready');
    expect(screen.queryByText('Pending — deliver when ready')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalise' })).toBeEnabled();
  });
  it('does not load unrelated file-assignment controls in the standalone finalise modal', async () => {
    render(<MediaMarkDialog request={{ shootId: 5935, initialTab: 'delivery' }} onClose={vi.fn()} />);
    await screen.findByText('Finished video is missing.');
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it('requires a reason and explicit receipt confirmation for historical assignment', async () => {
    const history = { ...discovery(), targets: [{ ...discovery().targets[0], historical: true }], files: [{ id: 21, shoot_service_id: 6100, content_version: 2 }], requires_historical_confirmation: true, receipt_revision: 'a'.repeat(64) };
    mocks.preview.mockResolvedValue(history); show('service');
    await screen.findByRole('checkbox', { name: /Review original delivered services/ });
    fireEvent.click(screen.getByRole('checkbox', { name: /Review original delivered services/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Showcase Unit A/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /Reason for assignment/ }), { target: { value: 'Correct reviewed original service ownership' } });
    await screen.findByText('Assignment ready');
    expect(screen.getByRole('button', { name: /Assign service/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm moving/ }));
    fireEvent.click(screen.getByRole('button', { name: /Assign service/ })); await screen.findByText('All set');
    expect(mocks.assign).toHaveBeenCalledWith(5935, expect.objectContaining({ confirm_historical: true, expected_receipt_revision: 'a'.repeat(64), reason: 'Correct reviewed original service ownership' }));
  });
  it('clears approvals after a stale-plan rejection and keeps the reason visible', async () => {
    mocks.plan.mockResolvedValueOnce(plan()).mockResolvedValue({ ...plan(), revision: 'revision-2' });
    mocks.finalize.mockResolvedValue({ status: 'error', message: 'Delivery plan changed. Review the latest work.' });
    show('delivery'); await screen.findByText('Finished video is missing.'); fireEvent.click(screen.getByRole('button', { name: 'Finalise' }));
    await screen.findByRole('alert'); await waitFor(() => expect(screen.getByRole('button', { name: 'Finalise' })).toBeDisabled());
    expect(screen.getByRole('alert')).toHaveTextContent('Delivery plan changed'); expect(mocks.plan).toHaveBeenCalledTimes(2);
  });
  it('reuses the same delivery key and scope after an uncertain response while the plan is unchanged', async () => {
    mocks.finalize.mockResolvedValueOnce({ status: 'error', message: 'Connection interrupted. Check or retry this delivery.' }).mockResolvedValueOnce({ status: 'completed', warnings: [] });
    show('delivery'); await screen.findByText('Finished video is missing.');
    fireEvent.click(screen.getByRole('button', { name: 'Finalise' })); await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Finalise' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Finalise' })); await screen.findByText('All set');
    expect(mocks.finalize.mock.calls[0][0].body).toEqual(mocks.finalize.mock.calls[1][0].body);
  });
});
