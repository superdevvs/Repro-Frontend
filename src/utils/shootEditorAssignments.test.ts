import { describe, expect, it } from 'vitest';
import { shootHasEditorAssignment } from './shootEditorAssignments';
import type { ShootData } from '@/types/shoots';

describe('shootHasEditorAssignment', () => {
  it('matches video editors assigned via video_editor_id on bundled services', () => {
    const shoot = {
      editor: { id: '10', name: 'Photo Editor' },
      serviceObjects: [
        {
          id: '91',
          name: 'HDR Photos & Video',
          editor_id: '10',
          video_editor_id: '22',
          editor: { id: '10', name: 'Photo Editor' },
        },
      ],
    } as Pick<ShootData, 'editor' | 'serviceObjects'>;

    expect(shootHasEditorAssignment(shoot, { id: '22', name: 'Video Editor' })).toBe(true);
    expect(shootHasEditorAssignment(shoot, { id: '10', name: 'Photo Editor' })).toBe(true);
    expect(shootHasEditorAssignment(shoot, { id: '99', name: 'Other' })).toBe(false);
  });

  it('matches video lane editorAssignments', () => {
    const shoot = {
      editorAssignments: [
        {
          lane: 'video',
          editorId: '22',
          editor: { id: '22', name: 'Video Editor' },
        },
      ],
    } as Pick<ShootData, 'editorAssignments'>;

    expect(shootHasEditorAssignment(shoot, { id: 22 })).toBe(true);
  });
});
