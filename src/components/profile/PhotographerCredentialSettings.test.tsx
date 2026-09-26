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
    <button type="button" onClick={() => onUploadComplete('https://files.example/new-pilot.pdf', 'Part 107')}>
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

  it('shows the license, insurance, and pilot license saved at account creation', () => {
    render(<PhotographerCredentialSettings />);
    expect(screen.getByRole('textbox', { name: 'License number' })).toHaveValue('OLD-1');
    expect(screen.getByRole('textbox', { name: 'Insurance Number' })).toHaveValue('POLICY-OLD');
    expect(screen.getByRole('textbox', { name: 'Pilot License name' })).toHaveValue('Old pilot');
    expect(screen.getByRole('link', { name: 'View Pilot License' })).toHaveAttribute('href', 'https://files.example/pilot.pdf');
    expect(screen.getByRole('link', { name: 'View Insurance Document' })).toHaveAttribute('href', 'https://files.example/insurance.pdf');
  });

  it('saves updated credentials and a replacement pilot license', async () => {
    const user = userEvent.setup();
    render(<PhotographerCredentialSettings />);
    const license = screen.getByRole('textbox', { name: 'License number' });
    await user.clear(license);
    await user.type(license, 'FAA-107');
    await user.click(screen.getByRole('button', { name: 'Change Pilot License' }));
    await user.click(screen.getByRole('button', { name: 'Upload Pilot License' }));
    await user.click(screen.getByRole('button', { name: 'Save Licenses' }));

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({
      license_number: 'FAA-107',
      insuranceNumber: 'POLICY-OLD',
      insuranceFile: 'https://files.example/insurance.pdf',
      insuranceFileName: 'Old insurance',
      pilotLicenseFile: 'https://files.example/new-pilot.pdf',
      pilotLicenseFileName: 'Part 107',
    }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Licenses updated' }));
  });

  it('clears a removed pilot license instead of leaving the old file in place', async () => {
    const user = userEvent.setup();
    render(<PhotographerCredentialSettings />);
    await user.click(screen.getByRole('button', { name: 'Remove Pilot License' }));
    await user.click(screen.getByRole('button', { name: 'Save Licenses' }));

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      pilotLicenseFile: null,
      pilotLicenseFileName: null,
      insuranceFile: 'https://files.example/insurance.pdf',
    })));
  });
});
