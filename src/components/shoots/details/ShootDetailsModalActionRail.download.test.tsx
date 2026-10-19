import { useState, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShootDetailsModalActionRail } from './ShootDetailsModalActionRail';

const noop = () => undefined;

function MobileActions({ role, download, sync, invoice }: { role: 'admin' | 'editor'; download: () => Promise<void>; sync?: () => void; invoice?: () => void }) {
  const [open, setOpen] = useState(true);
  const props: ComponentProps<typeof ShootDetailsModalActionRail> = {
    shootAddress: '12 Oak Street', statusBadge: <span>Uploaded</span>, isEditMode: false, editActions: null,
    isSavingChanges: false, isAdminOrRep: role === 'admin', isRequestedStatus: false, canAdminEdit: false,
    isScheduledOrOnHold: false, canUserPutOnHold: false, canResumeFromHold: false, canCancelShoot: false,
    canSendToEditing: false, canFinalise: false, canStartMmmPunchout: false, showMmmPunchoutButtons: false,
    mmmRedirectUrl: null, isDelivered: false, isAdmin: role === 'admin', isEditingManager: false,
    isClient: false, isEditor: role === 'editor', isPhotographer: false, canClientDownload: false,
    isGeneratingShareLink: false, isStartingMmmPunchout: false, rawFileCount: 1, editedMediaCount: 0,
    activeMediaDisplayTab: 'uploaded', selectedFileIds: [], isPublishingToBrightMls: false, showPublishToBrightMls: Boolean(sync),
    holdActionLabel: 'Hold', cancelActionLabel: 'Cancel shoot', isMobileActionsOpen: open, setIsMobileActionsOpen: setOpen,
    canSendManualNotification: false, onOpenManualNotification: noop, setIsApprovalModalOpen: noop,
    canShowInvoice: Boolean(invoice), onShowInvoice: invoice,
    setIsDeclineModalOpen: noop, setIsEditMode: noop, setIsDownloadDialogOpen: noop, handleMarkOnHoldClick: noop,
    handleResumeFromHold: noop, handleCancelShootClick: noop, handleSendToEditing: noop, handleFinalise: noop,
    handleDownloadMedia: download, handleSendToBrightMls: sync ?? noop, handleOpenMmm: noop, handleStartMmmPunchout: async () => {},
    handleEditorDownloadRaw: download, handleUploadEdits: noop, handleGenerateShareLink: noop, onClose: noop,
  };
  return <ShootDetailsModalActionRail {...props} />;
}

afterEach(cleanup);

describe('mobile and tablet shoot actions', () => {
  it('preserves invoice access when tablet actions use the drawer', () => {
    const invoice = vi.fn();
    render(<MobileActions role="admin" download={async () => {}} invoice={invoice} />);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Actions' })).getByRole('button', { name: 'Invoice' }));
    expect(invoice).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('keeps permitted Bright MLS sync reachable from tablet actions and closes the drawer before syncing', () => {
    const sync = vi.fn();
    render(<MobileActions role="admin" download={async () => {}} sync={sync} />);
    const dialog = screen.getByRole('dialog', { name: 'Actions' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish to Bright MLS' }));
    expect(sync).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it.each(['admin', 'editor'] as const)('keeps the %s download button visible with a compact spinner throughout transfer', async (role) => {
    let finish!: () => void;
    const download = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<MobileActions role={role} download={download} />);
    const dialog = screen.getByRole('dialog', { name: 'Actions' });
    const button = within(dialog).getByRole('button', { name: role === 'editor' ? 'Download' : 'Downloads' });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(download).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument();
    expect(button).toBeVisible();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg.animate-spin')).not.toBeNull();
    expect(button.querySelector('image[href^="/brand/re/"]')).toBeNull();
    await act(async () => { finish(); });
    expect(button).toBeEnabled();
    expect(button.querySelector('svg.animate-spin')).toBeNull();
    expect(button.querySelector('image[href^="/brand/re/"]')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: role === 'editor' ? 'Upload edits' : 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Actions' })).not.toBeInTheDocument();
  });
});
