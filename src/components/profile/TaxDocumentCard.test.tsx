import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TaxDocumentCard } from './TaxDocumentCard';
import { downloadTaxDocument, readTaxDocument, uploadTaxDocument } from '@/services/taxDocuments';

const context = vi.hoisted(() => ({ user: { id: '1', metadata: { tax_document_url: 'https://unsafe.example.test/old.pdf' } }, isImpersonating: false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => context }));
vi.mock('@/services/taxDocuments', async (original) => ({
  ...await original<typeof import('@/services/taxDocuments')>(),
  readTaxDocument: vi.fn(), uploadTaxDocument: vi.fn(), downloadTaxDocument: vi.fn(),
}));

const summary = { id: 'doc1', original_name: 'private-w9.pdf', mime_type: 'application/pdf', size: 40, submitted_at: '2026-01-01T00:00:00Z', can_download: true };

describe('private tax document card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.isImpersonating = false;
    vi.mocked(readTaxDocument).mockResolvedValue(summary);
    vi.mocked(downloadTaxDocument).mockResolvedValue();
  });
  afterEach(cleanup);

  it('loads the dedicated summary and downloads through the authenticated service without public links', async () => {
    render(<TaxDocumentCard />);
    expect(await screen.findByText(/private-w9.pdf/)).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(document.querySelector('a[href]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(downloadTaxDocument).toHaveBeenCalledWith('private-w9.pdf'));
    expect(document.body.innerHTML).not.toContain('unsafe.example.test');
  });

  it('does not load or show documents during impersonation', () => {
    context.isImpersonating = true;
    render(<TaxDocumentCard />);
    expect(screen.getByText(/unavailable while impersonating/)).toBeInTheDocument();
    expect(readTaxDocument).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uploads a replacement and updates its submission summary', async () => {
    vi.mocked(uploadTaxDocument).mockResolvedValue({ ...summary, original_name: 'replacement.pdf' });
    render(<TaxDocumentCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));
    const file = new File(['%PDF-1.4 test'], 'replacement.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Document'), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'Private note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    await waitFor(() => expect(uploadTaxDocument).toHaveBeenCalledWith(file, 'Private note'));
    expect(await screen.findByText(/replacement.pdf/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects unsupported documents before upload', async () => {
    render(<TaxDocumentCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));
    fireEvent.change(screen.getByLabelText('Document'), { target: { files: [new File(['data'], 'document.doc')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a PDF, PNG or JPG');
    expect(uploadTaxDocument).not.toHaveBeenCalled();
  });

  it('keeps existing submission information and shows a safe message when upload confirmation fails', async () => {
    vi.mocked(uploadTaxDocument).mockRejectedValue(new Error('internal/private/location'));
    render(<TaxDocumentCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));
    fireEvent.change(screen.getByLabelText('Document'), { target: { files: [new File(['pdf'], 'new.pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not confirm your upload');
    expect(document.body.innerHTML).not.toContain('internal/private/location');
    expect(screen.getByText(/private-w9.pdf/)).toBeInTheDocument();
  });
});
