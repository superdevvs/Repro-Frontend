import { describe, expect, it } from 'vitest';
import {
  canAccessOverviewVideoEmbedsOnShoot,
  isPhotoOnlyEditorOnShoot,
  isVideoOnlyEditorOnShoot,
  readEditingCapabilities,
  shootHasEditorAssignment,
} from './shootEditorAssignments';
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

describe('readEditingCapabilities', () => {
  it('reads metadata.editing_capabilities', () => {
    expect(
      readEditingCapabilities({ metadata: { editing_capabilities: ['video'] } }),
    ).toEqual(['video']);
    expect(
      readEditingCapabilities({ metadata: { editing_capabilities: ['photo', 'video'] } }),
    ).toEqual(['photo', 'video']);
  });
});

describe('isVideoOnlyEditorOnShoot', () => {
  const bundledShoot = {
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

  it('hides photo tabs for video_editor_id assignee who is not also photo editor', () => {
    expect(
      isVideoOnlyEditorOnShoot(bundledShoot, {
        id: '22',
        role: 'editor',
        metadata: { editing_capabilities: ['video'] },
      }),
    ).toBe(true);
  });

  it('keeps photo tabs for the photo editor_id on the same shoot', () => {
    expect(
      isVideoOnlyEditorOnShoot(bundledShoot, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo'] },
      }),
    ).toBe(false);
  });

  it('never hides for admin / editing_manager / photographer', () => {
    for (const role of ['admin', 'editing_manager', 'photographer', 'salesRep', 'superadmin']) {
      expect(
        isVideoOnlyEditorOnShoot(bundledShoot, { id: '22', role }),
      ).toBe(false);
    }
  });

  it('matches lane=video editorAssignments without photo assignment', () => {
    const shoot = {
      editorAssignments: [
        { lane: 'video', editorId: '22', editor: { id: '22', name: 'Video Editor' } },
      ],
    } as Pick<ShootData, 'editorAssignments'>;

    expect(
      isVideoOnlyEditorOnShoot(shoot, {
        id: '22',
        role: 'editor',
        metadata: { editing_capabilities: ['video'] },
      }),
    ).toBe(true);
  });

  it('falls back to video-only caps when assigned via general editor match', () => {
    const shoot = {
      editor: { id: '22', name: 'Video Editor' },
      serviceObjects: [
        {
          id: '5',
          name: 'Video Walkthrough',
          editor_id: '22',
          editor: { id: '22', name: 'Video Editor' },
        },
      ],
    } as Pick<ShootData, 'editor' | 'serviceObjects'>;

    expect(
      isVideoOnlyEditorOnShoot(shoot, {
        id: '22',
        role: 'editor',
        metadata: { editing_capabilities: ['video'] },
      }),
    ).toBe(true);

    expect(
      isVideoOnlyEditorOnShoot(shoot, {
        id: '22',
        role: 'editor',
        metadata: { editing_capabilities: ['photo', 'video'] },
      }),
    ).toBe(false);
  });
});

describe('isPhotoOnlyEditorOnShoot', () => {
  const bundledShoot = {
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

  it('hides video UI for editor_id assignee who is not also video editor', () => {
    expect(
      isPhotoOnlyEditorOnShoot(bundledShoot, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo'] },
      }),
    ).toBe(true);
  });

  it('keeps video UI for the video_editor_id on the same shoot', () => {
    expect(
      isPhotoOnlyEditorOnShoot(bundledShoot, {
        id: '22',
        role: 'editor',
        metadata: { editing_capabilities: ['video'] },
      }),
    ).toBe(false);
  });

  it('never hides for admin / editing_manager / photographer / sales', () => {
    for (const role of ['admin', 'editing_manager', 'photographer', 'salesRep', 'superadmin']) {
      expect(
        isPhotoOnlyEditorOnShoot(bundledShoot, { id: '10', role }),
      ).toBe(false);
    }
  });

  it('does not hide when dual-assigned on editor_id and video_editor_id', () => {
    const dual = {
      serviceObjects: [
        {
          id: '91',
          name: 'HDR Photos & Video',
          editor_id: '10',
          video_editor_id: '10',
          editor: { id: '10', name: 'Both' },
        },
      ],
    } as Pick<ShootData, 'serviceObjects'>;

    expect(
      isPhotoOnlyEditorOnShoot(dual, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo'] },
      }),
    ).toBe(false);
  });

  it('matches lane=photo editorAssignments without video assignment', () => {
    const shoot = {
      editorAssignments: [
        { lane: 'photo', editorId: '10', editor: { id: '10', name: 'Photo Editor' } },
      ],
    } as Pick<ShootData, 'editorAssignments'>;

    expect(
      isPhotoOnlyEditorOnShoot(shoot, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo'] },
      }),
    ).toBe(true);
  });

  it('falls back to photo-only caps when assigned via general editor match', () => {
    const shoot = {
      editor: { id: '10', name: 'Photo Editor' },
      serviceObjects: [
        {
          id: '5',
          name: 'HDR Photos',
          editor_id: '10',
          editor: { id: '10', name: 'Photo Editor' },
        },
      ],
    } as Pick<ShootData, 'editor' | 'serviceObjects'>;

    expect(
      isPhotoOnlyEditorOnShoot(shoot, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo'] },
      }),
    ).toBe(true);

    expect(
      isPhotoOnlyEditorOnShoot(shoot, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo', 'video'] },
      }),
    ).toBe(false);
  });
});

describe('canAccessOverviewVideoEmbedsOnShoot', () => {
  const bundledShoot = {
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

  it('shows for video_editor_id assignee', () => {
    expect(
      canAccessOverviewVideoEmbedsOnShoot(bundledShoot, {
        id: '22',
        role: 'editor',
        metadata: { editing_capabilities: ['video'] },
      }),
    ).toBe(true);
  });

  it('shows for video assignee even without caps stamped', () => {
    expect(
      canAccessOverviewVideoEmbedsOnShoot(bundledShoot, {
        id: '22',
        role: 'editor',
      }),
    ).toBe(true);
  });

  it('shows for dual-capable editor assigned on the shoot (photo slot)', () => {
    expect(
      canAccessOverviewVideoEmbedsOnShoot(bundledShoot, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo', 'video'] },
      }),
    ).toBe(true);
  });

  it('hides for photo-only editor assignee', () => {
    expect(
      canAccessOverviewVideoEmbedsOnShoot(bundledShoot, {
        id: '10',
        role: 'editor',
        metadata: { editing_capabilities: ['photo'] },
      }),
    ).toBe(false);
  });

  it('hides for admin / superadmin / editing_manager / sales / photographer', () => {
    for (const role of ['admin', 'superadmin', 'super_admin', 'editing_manager', 'salesRep', 'photographer']) {
      expect(
        canAccessOverviewVideoEmbedsOnShoot(bundledShoot, { id: '22', role }),
      ).toBe(false);
    }
  });

  it('hides for video-capable editor not assigned on the shoot', () => {
    expect(
      canAccessOverviewVideoEmbedsOnShoot(bundledShoot, {
        id: '99',
        role: 'editor',
        metadata: { editing_capabilities: ['video'] },
      }),
    ).toBe(false);
  });
});
