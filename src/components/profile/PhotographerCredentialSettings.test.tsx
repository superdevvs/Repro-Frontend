import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotographerCredentialSettings } from './PhotographerCredentialSettings';

const mocks = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  toast: vi.fn(),
  user: {
    id: '42',
    role: 'photographer',
    license_number: 'OLD-1',
    metadata: {
      idDocumentFile: 'https://files.example/passport.pdf',
      idDocumentFileName: 'Passport',
      insuranceNumber: 'POLICY-OLD',
      insuranceFile: 'https://files.example/insurance.pdf',
      insuranceFileName: 'Old insurance',
      pilotLicenseFile: 'https://files.example/pilot.pdf',
      pilotLicenseFileName: 'Old pilot',
      specialties: ['category:old'],
    },
  },
}));

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useSelfProfileSave', () => ({ useSelfProfileSave: () => ({ saveProfile: mocks.saveProfile }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/components/accounts/FileUploadModal', () => ({
  FileUploadModal: ({
    open,
    title,
    onUploadComplete,
  }: {
    open: boolean;
    title: string;
    onUploadComplete: (url: string, fileName?: string) => void;
  }) => (open ? (
    <button type="button" onClick={() => onUploadComplete(
      title.includes('ID') ? 'https://files.example/id.pdf' : 'https://files.example/new-pilot.pdf',
      title.includes('ID') ? 'Driver license' : 'Part 107',
    )}>
      {title}
    </button>
  ) : null),
}));

describe('photographer credential settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveProfile.mockResolvedValue({ user: mocks.user, reauthRequired: false });
  });
  afterEach(() => cleanup());

  it('shows the ID, insurance, and pilot license saved on the account', () => {
    render(<PhotographerCredentialSettings />);
    expect(screen.queryByRole('textbox', { name: 'License number' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ID / Passport name' })).toHaveValue('Passport');
    expect(screen.getByRole('link', { name: 'View ID / Passport' })).toHaveAttribute('href', 'https://files.example/passport.pdf');
    expect(screen.getByRole('textbox', { name: 'Insurance Number' })).toHaveValue('POLICY-OLD');
    expect(screen.getByRole('textbox', { name: 'Pilot License name' })).toHaveValue('Old pilot');
    expect(screen.getByRole('link', { name: 'View Pilot License' })).toHaveAttribute('href', 'https://files.example/pilot.pdf');
    expect(screen.getByRole('link', { name: 'View Insurance Document' })).toHaveAttribute('href', 'https://files.example/insurance.pdf');
  });

  it('saves a replacement ID or passport without changing the stored license number', async () => {
    const user = userEvent.setup();
    render(<PhotographerCredentialSettings />);
    await user.click(screen.getByRole('button', { name: 'Change ID / Passport' }));
    await user.click(screen.getByRole('button', { name: 'Upload ID or Passport' }));
    await user.click(screen.getByRole('button', { name: 'Save documents' }));

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({
      idDocumentFile: 'https://files.example/id.pdf',
      idDocumentFileName: 'Driver license',
      insuranceNumber: 'POLICY-OLD',
      insuranceFile: 'https://files.example/insurance.pdf',
      insuranceFileName: 'Old insurance',
      pilotLicenseFile: 'https://files.example/pilot.pdf',
      pilotLicenseFileName: 'Old pilot',
    }));
    expect(mocks.saveProfile.mock.calls[0][0]).not.toHaveProperty('license_number');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Documents updated' }));
  });

  it('clears a removed pilot license instead of leaving the old file in place', async () => {
    const user = userEvent.setup();
    render(<PhotographerCredentialSettings />);
    await user.click(screen.getByRole('button', { name: 'Remove Pilot License' }));
    await user.click(screen.getByRole('button', { name: 'Save documents' }));

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      pilotLicenseFile: null,
      pilotLicenseFileName: null,
      insuranceFile: 'https://files.example/insurance.pdf',
    })));
  });
});
