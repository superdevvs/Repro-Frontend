import { describe, expect, it } from 'vitest';
import { formatEditorCapabilityLabel, formatUserRoleLabel } from './userRoleLabels';

describe('formatEditorCapabilityLabel', () => {
  it('maps photo-only / video-only / dual', () => {
    expect(formatEditorCapabilityLabel(['photo'])).toBe('Photo editor');
    expect(formatEditorCapabilityLabel(['video'])).toBe('Video editor');
    expect(formatEditorCapabilityLabel(['photo', 'video'])).toBe('Photo & Video editor');
    expect(formatEditorCapabilityLabel([])).toBeNull();
  });
});

describe('formatUserRoleLabel', () => {
  it('keeps non-editor roles', () => {
    expect(formatUserRoleLabel('admin')).toBe('Admin');
    expect(formatUserRoleLabel('editing_manager')).toBe('Editing Manager');
    expect(formatUserRoleLabel('salesRep')).toBe('Sales Rep');
    expect(formatUserRoleLabel('photographer')).toBe('Photographer');
  });

  it('falls back to Editor when caps missing (list light payload)', () => {
    expect(formatUserRoleLabel('editor')).toBe('Editor');
    expect(formatUserRoleLabel('editor', { role: 'editor' })).toBe('Editor');
    expect(formatUserRoleLabel('editor', { metadata: {} })).toBe('Editor');
  });

  it('maps editor subtypes from editing_capabilities', () => {
    expect(
      formatUserRoleLabel('editor', { metadata: { editing_capabilities: ['photo'] } }),
    ).toBe('Photo editor');
    expect(
      formatUserRoleLabel('editor', { metadata: { editing_capabilities: ['video'] } }),
    ).toBe('Video editor');
    expect(
      formatUserRoleLabel('editor', { editingCapabilities: ['photo', 'video'] }),
    ).toBe('Photo & Video editor');
  });

  it('prefers role_label / roleLabel over caps mapping', () => {
    expect(
      formatUserRoleLabel('editor', {
        role_label: 'Photo editor',
        editing_capabilities: ['video'],
      }),
    ).toBe('Photo editor');
    expect(
      formatUserRoleLabel('editor', {
        roleLabel: 'Video editor',
        editingCapabilities: ['photo'],
      }),
    ).toBe('Video editor');
    expect(
      formatUserRoleLabel('admin', { role_label: 'Admin' }),
    ).toBe('Admin');
  });

  it('ignores blank role_label and falls back to caps', () => {
    expect(
      formatUserRoleLabel('editor', {
        role_label: '  ',
        editing_capabilities: ['photo'],
      }),
    ).toBe('Photo editor');
  });
});
