import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmSubmitDialog, type ConfirmSubmitKind } from './ConfirmSubmitDialog';

afterEach(cleanup);

describe('shoot submission confirmation', () => {
  it.each<[ConfirmSubmitKind, string, string]>([
    ['raw', 'photographer', 'Uploaded'], ['edited', 'editor', 'In Review'],
    ['edited', 'editing_manager', 'Ready'], ['edited', 'admin', 'Ready'], ['edited', 'superadmin', 'Ready'],
    ['edited', ' Super_Admin ', 'Ready'],
  ])(
    'describes the actual %s submission transition for %s', async (kind, role, status) => {
      const onConfirm = vi.fn();
      render(<ConfirmSubmitDialog open kind={kind} submittingRole={role} fileCount={1} isSubmitting={false}
        hasInflightUploads={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
      expect(screen.getByText(status)).toBeInTheDocument();
      if (status === 'In Review') expect(screen.queryByText('Ready')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Yes, submit' }));
      expect(onConfirm).toHaveBeenCalledOnce();
    },
  );

  it('keeps submission blocked while files are uploading', () => {
    render(<ConfirmSubmitDialog open kind="edited" submittingRole="editor" fileCount={1} isSubmitting={false}
      hasInflightUploads onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Yes, submit' })).toBeDisabled();
  });
});
