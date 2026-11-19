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
const show = (initialTab: 'delivery') => render(<MediaMarkDialog request={{ shootId: 5935, shootLabel: '18013 Highfield Road', files: [file], allowType: true, initialTab }} onClose={vi.fn()} />);

describe('shared media Mark workspace', () => {
  const edited = (id: string, extra: Partial<MediaFile> = {}) => ({ ...file, id, workflowStage: 'verified', media_type: 'edited', ...extra }) as MediaFile;
  const showFiles = (files: MediaFile[] = [file]) => render(<MediaMarkDialog request={{ shootId: 5935, shootLabel: '18013 Highfield Road', files, allowType: true }} onClose={vi.fn()} />);
  const ok = (data: object = { updated_count: 1 }) => ({ ok: true, json: async () => data });
  const save = () => screen.getByRole('button', { name: /Save changes/ });
  it('shows service, category and visibility on one screen without tabs or delivery', async () => {
    showFiles([edited('21')]);
    await screen.findByRole('radio', { name: /Showcase Unit A/ });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Category/ })).toHaveDisplayValue('Keep current (Main photos)');
    expect(screen.getByRole('switch', { name: 'Hidden from client' })).not.toBeChecked();
    expect(screen.queryByText(/Finalise/)).not.toBeInTheDocument();
    expect(mocks.plan).not.toHaveBeenCalled();
    expect(save()).toBeDisabled();
  });
  it('changes only the category without sending a service, visibility or delivery mutation', async () => {
    const fetch = vi.fn().mockResolvedValue(ok()); vi.stubGlobal('fetch', fetch);
    showFiles(); await screen.findByRole('radio', { name: /Showcase Unit A/ });
    fireEvent.change(screen.getByRole('combobox', { name: /Category/ }), { target: { value: 'drone' } });
    expect(screen.getByText('Category: Drone')).toBeInTheDocument();
    fireEvent.click(save()); await screen.findByText('All set');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ file_ids: [21], media_type: 'drone' });
    expect(mocks.assign).not.toHaveBeenCalled(); expect(mocks.finalize).not.toHaveBeenCalled(); expect(mocks.refresh).toHaveBeenCalledWith(5935);
  });
  it('previews the exact saved file version and target before assigning across unit scopes', async () => {
    showFiles(); fireEvent.click(await screen.findByRole('radio', { name: /Showcase Unit A/ }));
    await waitFor(() => expect(save()).toBeEnabled());
    fireEvent.click(save()); await screen.findByText('All set');
    expect(mocks.assign).toHaveBeenCalledWith(5935, expect.objectContaining({ file_ids: [21], shoot_service_id: 6117, expected_target_unit_id: 9001, expected_files: discovery().files, idempotency_key: expect.any(String), confirm_historical: false }));
  });
  it('saves service, category and Hidden together in one step', async () => {
    const fetch = vi.fn().mockResolvedValue(ok()); vi.stubGlobal('fetch', fetch);
    showFiles([edited('21')]); fireEvent.click(await screen.findByRole('radio', { name: /Showcase Unit A/ }));
    fireEvent.change(screen.getByRole('combobox', { name: /Category/ }), { target: { value: 'floorplan' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Hidden from client' }));
    expect(screen.getByText('Move to Showcase · Category: Floorplan · Hidden from client')).toBeInTheDocument();
    await waitFor(() => expect(save()).toBeEnabled());
    fireEvent.click(save()); await screen.findByText('All set');
    expect(mocks.assign).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.map(call => call[0])).toEqual([expect.stringMatching(/\/files\/reclassify$/), expect.stringMatching(/\/files\/client-visibility$/)]);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ file_ids: [21], hidden: true });
    expect(screen.getByText(/Admins and editing managers still see it/)).toBeInTheDocument();
  });
  it('reports which change succeeded when a later one fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Only edited media can be hidden from the client.' }) }));
    showFiles([edited('21')]); await screen.findByRole('radio', { name: /Showcase Unit A/ });
    fireEvent.change(screen.getByRole('combobox', { name: /Category/ }), { target: { value: 'twilight' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Hidden from client' }));
    fireEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Set 1 file to Twilight. The next change failed: Only edited media can be hidden from the client.');
    expect(mocks.refresh).toHaveBeenCalledWith(5935);
  });
  it.each(['admin', 'superadmin', 'editing_manager'])('lets %s restore client-hidden media', async role => {
    mocks.role = role;
    const fetch = vi.fn().mockResolvedValue(ok({ updated_count: 2 })); vi.stubGlobal('fetch', fetch);
    showFiles([edited('21', { is_client_hidden: true }), edited('22', { is_client_hidden: true })]);
    const toggle = await screen.findByRole('switch', { name: 'Hidden from client' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle); fireEvent.click(save());
    await screen.findByText(/2 files are visible to the client again/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ file_ids: [21, 22], hidden: false });
  });
  it('hides a mixed selection and counts only the files that change', async () => {
    const fetch = vi.fn().mockResolvedValue(ok()); vi.stubGlobal('fetch', fetch);
    showFiles([edited('21', { is_client_hidden: true }), edited('22')]);
    expect(await screen.findByText(/1 of 2 selected files are hidden now/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Hidden from client' })); fireEvent.click(save());
    await screen.findByText(/Hid 1 file from the client/);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ file_ids: [21, 22], hidden: true });
  });
  it.each(['editor', 'photographer'])('lets %s change only the category', async role => {
    mocks.role = role; showFiles([edited('21')]);
    expect(screen.getByRole('combobox', { name: /Category/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Hidden from client' })).not.toBeInTheDocument();
    expect(mocks.plan).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it.each(['salesrep', 'client'])('does not fetch or expose staff controls to %s', async role => {
    mocks.role = role; showFiles([edited('21')]);
    expect(screen.getByText('This action is unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument(); expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(mocks.plan).not.toHaveBeenCalled(); expect(mocks.preview).not.toHaveBeenCalled();
  });
  it('does not offer the Hidden marking for raw (unedited) media', async () => {
    showFiles([edited('21', { workflowStage: 'todo' })]);
    await screen.findByRole('radio', { name: /Showcase Unit A/ });
    expect(screen.queryByRole('switch', { name: 'Hidden from client' })).not.toBeInTheDocument();
  });
  it('requires a reason and explicit receipt confirmation for historical assignment', async () => {
    const history = { ...discovery(), targets: [{ ...discovery().targets[0], historical: true }], files: [{ id: 21, shoot_service_id: 6100, content_version: 2 }], requires_historical_confirmation: true, receipt_revision: 'a'.repeat(64) };
    mocks.preview.mockResolvedValue(history); showFiles();
    await screen.findByRole('checkbox', { name: /Review original delivered services/ });
    fireEvent.click(screen.getByRole('checkbox', { name: /Review original delivered services/ }));
    fireEvent.click(await screen.findByRole('radio', { name: /Showcase Unit A/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /Reason for assignment/ }), { target: { value: 'Correct reviewed original service ownership' } });
    await screen.findByText('Assignment ready');
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm moving/ }));
    fireEvent.click(save()); await screen.findByText('All set');
    expect(mocks.assign).toHaveBeenCalledWith(5935, expect.objectContaining({ confirm_historical: true, expected_receipt_revision: 'a'.repeat(64), reason: 'Correct reviewed original service ownership' }));
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
  it('honors denied server capabilities even for an admin', async () => {
    mocks.role = 'admin'; mocks.plan.mockResolvedValue({ ...plan(), capabilities: { can_finalize: false, can_manual_no_content: false, can_assign_service: false } }); mocks.preview.mockResolvedValue({ ...discovery(), capabilities: { can_assign_service: false } });
    show('delivery'); await screen.findByText('This action is unavailable'); expect(screen.queryByRole('tab', { name: 'Service' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Finalise' })).toBeDisabled();
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
  it('completes previously deferred work without content only after a reason and confirmation', async () => {
    mocks.plan.mockResolvedValue({ ...plan(), components: [component('photos', 'photo', 'delivered'), { ...component('plans', 'floorplan', 'pending'), deferred: true, methods: ['defer', 'manual_no_content'] }] });
    show('delivery'); await screen.findByRole('switch', { name: 'Complete without content' });
    expect(screen.queryByRole('switch', { name: 'Finalise without waiting' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Complete without content' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Floorplans — Showcase' }));
    expect(screen.getByText('Completes without content')).toBeInTheDocument();
    const apply = screen.getByRole('button', { name: 'Finalise' });
    expect(apply).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Reason for completing without content/ }), { target: { value: 'Client cancelled the floorplan' } });
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I confirm Floorplans is complete without content/ }));
    expect(apply).toBeEnabled();
    fireEvent.click(apply); await screen.findByText('All set');
    expect(mocks.finalize).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ component_ids: ['plans'], mode: 'auto', allow_without_content: false, complete_without_content: true, reason: 'Client cancelled the floorplan', confirmed: true }) }));
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
