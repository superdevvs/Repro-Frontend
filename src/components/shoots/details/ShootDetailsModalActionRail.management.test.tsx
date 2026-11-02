import type { ComponentProps } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShootDetailsModalActionRail } from './ShootDetailsModalActionRail';

const noop = () => undefined;
const props: ComponentProps<typeof ShootDetailsModalActionRail> = {
  shootAddress: 'Historical shoot', statusBadge: <span>Delivered</span>, isEditMode: false, editActions: null,
  isSavingChanges: false, isAdminOrRep: true, isRequestedStatus: false, canAdminEdit: false,
  // Delivered imports without a photographer still satisfy this legacy fallback.
  isScheduledOrOnHold: true, canUserPutOnHold: false, canResumeFromHold: false, canCancelShoot: false,
  canSendToEditing: false, canFinalise: false, canStartMmmPunchout: false, showMmmPunchoutButtons: false,
  mmmRedirectUrl: null, isDelivered: true, isAdmin: false, isEditingManager: false,
  isClient: false, isEditor: false, isPhotographer: false, canClientDownload: false,
  isGeneratingShareLink: false, isStartingMmmPunchout: false, rawFileCount: 0, editedMediaCount: 0,
  activeMediaDisplayTab: 'uploaded', selectedFileIds: [], isPublishingToBrightMls: false, showPublishToBrightMls: false,
  holdActionLabel: 'Hold', cancelActionLabel: 'Cancel shoot', isMobileActionsOpen: false, setIsMobileActionsOpen: noop,
  canSendManualNotification: false, onOpenManualNotification: noop, setIsApprovalModalOpen: noop,
  setIsDeclineModalOpen: noop, setIsEditMode: vi.fn(), setIsDownloadDialogOpen: noop, handleMarkOnHoldClick: noop,
  handleResumeFromHold: noop, handleCancelShootClick: noop, handleSendToEditing: noop, handleFinalise: noop,
  handleDownloadMedia: noop, handleSendToBrightMls: noop, handleOpenMmm: noop, handleStartMmmPunchout: async () => {},
  handleEditorDownloadRaw: noop, handleUploadEdits: noop, handleGenerateShareLink: noop, onClose: noop,
};

afterEach(cleanup);

describe('shoot action rail booking capability', () => {
  it('hides desktop and mobile edits for explicitly denied delivered imports without a photographer', () => {
    const { rerender } = render(<ShootDetailsModalActionRail {...props} canManageBooking={false} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    rerender(<ShootDetailsModalActionRail {...props} canManageBooking={false} isMobileActionsOpen />);
    expect(within(screen.getByRole('dialog', { name: 'Actions' })).queryByRole('button', { name: 'Edit shoot' })).not.toBeInTheDocument();
  });

  it('hides desktop and mobile booking edits when the capability is absent', () => {
    const { rerender } = render(<ShootDetailsModalActionRail {...props} isDelivered={false} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    rerender(<ShootDetailsModalActionRail {...props} isDelivered={false} isMobileActionsOpen />);
    expect(within(screen.getByRole('dialog', { name: 'Actions' })).queryByRole('button', { name: 'Edit shoot' })).not.toBeInTheDocument();
  });

  it('preserves the requested-shoot approval and modification flow', () => {
    render(<ShootDetailsModalActionRail {...props} isDelivered={false} isRequestedStatus canAdminEdit canManageBooking canReviewRequests canApproveRequest />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modify' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit shoot' })).not.toBeInTheDocument();
  });

  it('offers request rejection without approval or modification when booking edits are denied', () => {
    render(<ShootDetailsModalActionRail {...props} isRequestedStatus canManageBooking={false} canReviewRequests />);
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modify' })).not.toBeInTheDocument();
  });

  it('does not restore editing through scheduled-role fallbacks after a server denial', () => {
    render(<ShootDetailsModalActionRail {...props} isDelivered={false} canManageBooking canAdminEdit={false} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
