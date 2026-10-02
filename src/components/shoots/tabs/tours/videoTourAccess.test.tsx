import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShootData, ShootServiceObject } from '@/types/shoots';
import { canEditVideoTours } from './videoTourAccess';
import { useShootDetailsController } from '../../modal/useShootDetailsController';
import { transformShootFromApi } from '@/context/shootNormalization';

const editor = { id: '22', role: 'editor', metadata: { editing_capabilities: ['video'] } };
const line = (values: Partial<ShootServiceObject>): ShootServiceObject => ({ id: '5', name: 'Video', price: 100, quantity: 1, upload_intake_type: 'photo_video', ...values });
const shoot = (lines: ShootServiceObject[] = []): ShootData => ({ id: '42', status: 'editing', services: [], serviceItems: lines,
  payment: { totalPaid: 0, totalQuote: 100 }, location: {}, client: {}, photographer: {} } as ShootData);
afterEach(cleanup);

describe('video editor Tours access', () => {
  it('restores Overview and Tours access from the role-filtered API lane summary', () => {
    const value = transformShootFromApi({ id: 42, workflow_status: 'delivered',
      service_items: [{ id: 221, service_id: 102, editor_id: 99, upload_intake_type: 'photo_video' }],
      editor_assignments: [{ lane: 'video', editor_id: 22, shoot_service_ids: [221] }],
      tour_links: { video_link: 'https://vimeo.com/123456789', video_branded: 'https://example.com/branded' } });
    expect(value.serviceItems?.[0]?.video_editor_id).toBeNull();
    expect(canEditVideoTours(value, { ...editor, metadata: {} })).toBe(true);
    expect(canEditVideoTours(value, { ...editor, id: '99', metadata: { editing_capabilities: ['photo'] } })).toBe(false);
    expect(canEditVideoTours(value, { ...editor, id: '33' })).toBe(false);
    expect(value.tourLinks).toMatchObject({ video_link: 'https://vimeo.com/123456789', video_branded: 'https://example.com/branded' });
    const { result } = renderHook(() => useShootDetailsController({ shoot: value,
      authRole: 'editor', userId: '22', editorUser: editor }));
    expect(result.current.visibleTabs).toContainEqual({ id: 'tours', label: 'Tours', disabled: false });
  });
  it('uses summary service-row IDs only within the assigned unit, including repeated catalog services', () => {
    const value = transformShootFromApi({ id: 42,
      service_lines: [{ id: 221, service_id: 102, shoot_unit_id: 1, editor_id: 99, upload_intake_type: 'photo_video' },
        { id: 222, service_id: 102, shoot_unit_id: 2, editor_id: 99, upload_intake_type: 'photo_video' }],
      editor_assignments: [{ lane: 'video', editor_id: 22, service_ids: [102], shoot_service_ids: [221] }] });
    expect(value.editorAssignments?.[0]?.shootServiceIds).toEqual(['221']);
    expect(canEditVideoTours(value, editor, 1)).toBe(true);
    expect(canEditVideoTours(value, editor, 2)).toBe(false);
    expect(canEditVideoTours(value, editor, 3)).toBe(false);
    value.editorAssignments![0].shootServiceIds = undefined;
    expect(canEditVideoTours(value, editor, 1)).toBe(false);
  });
  it.each(['client', 'photographer', 'admin', 'superadmin', 'editing_manager', 'salesRep', ''])('does not grant video-editor writes to %s', role => {
    expect(canEditVideoTours(shoot([line({ video_editor_id: '22' })]), { ...editor, role })).toBe(false);
  });
  it('requires assignment and permits explicit video lanes despite stale capability metadata', () => {
    expect(canEditVideoTours(shoot([line({ video_editor_id: '22' })]), { ...editor, metadata: {} })).toBe(true);
    expect(canEditVideoTours(shoot([line({ editor_id: '22', upload_intake_type: 'video' })]), { ...editor, metadata: {} })).toBe(true);
    expect(canEditVideoTours(shoot([line({ editor_id: '99' })]), editor)).toBe(false);
    expect(canEditVideoTours(shoot([line({ editor_id: '22', video_editor_id: '99' })]), editor)).toBe(false);
    expect(canEditVideoTours(shoot([line({ editor_id: '22', video_editor_id: '99', upload_intake_type: 'video' })]), editor)).toBe(false);
    expect(canEditVideoTours(shoot([line({ editor_id: '22' })]), { ...editor, metadata: { editing_capabilities: ['photo'] } })).toBe(false);
  });
  it('limits unit writes to local assignments and requires a fully unassigned unit for legacy fallback', () => {
    const value = shoot();
    value.editor = { id: '22', name: 'Editor' };
    value.editorAssignments = [{ lane: 'video', editorId: '22' }];
    value.service_lines = [line({ shoot_unit_id: 1, video_editor_id: '22' }), line({ shoot_unit_id: 2, video_editor_id: '99' }),
      line({ shoot_unit_id: 3 }), line({ shoot_unit_id: 4 }), line({ shoot_unit_id: 4, editor_id: '99' })];
    expect(canEditVideoTours(value, editor, 1)).toBe(true);
    expect(canEditVideoTours(value, editor, 2)).toBe(false);
    expect(canEditVideoTours(value, editor, 3)).toBe(true);
    expect(canEditVideoTours(value, editor, 4)).toBe(false);
    expect(canEditVideoTours(value, editor, 5)).toBe(false);
  });
  it('exposes Tours through the shared page/modal controller and revokes it when the active role changes', () => {
    const value = shoot([line({ video_editor_id: '22' })]);
    const { result, rerender } = renderHook(({ role }) => useShootDetailsController({ shoot: value,
      authRole: role, userId: '22', editorUser: editor }), { initialProps: { role: 'editor' } });
    expect(result.current.visibleTabs).toContainEqual({ id: 'tours', label: 'Tours', disabled: false });
    expect(result.current.visibleTabs.some(tab => tab.id === 'settings')).toBe(false);
    rerender({ role: 'photographer' });
    expect(result.current.visibleTabs.some(tab => tab.id === 'tours')).toBe(false);
  });
  it('preserves existing client release locking and requested-shoot rules', () => {
    const value = shoot([line({ video_editor_id: '22' })]);
    const { result, rerender } = renderHook(({ role, status }) => useShootDetailsController({ shoot: { ...value, status },
      authRole: role, userId: '22', editorUser: editor }), { initialProps: { role: 'client', status: 'editing' } });
    expect(result.current.visibleTabs.find(tab => tab.id === 'tours')?.disabled).toBe(true);
    rerender({ role: 'editor', status: 'requested' });
    expect(result.current.visibleTabs.some(tab => tab.id === 'tours')).toBe(false);
  });
});
