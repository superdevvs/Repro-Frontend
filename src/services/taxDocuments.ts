import { apiClient } from '@/services/api';

export interface TaxDocumentSummary {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
  submitted_at: string;
  can_download: boolean;
}

export const readTaxDocument = async (signal?: AbortSignal): Promise<TaxDocumentSummary | null> => {
  const response = await apiClient.get<{ tax_document: TaxDocumentSummary | null }>('/profile/tax-document', { signal });
  return response.data.tax_document;
};

export const uploadTaxDocument = async (document: File, notes: string): Promise<TaxDocumentSummary> => {
  const data = new FormData();
  data.append('document', document);
  if (notes.trim()) data.append('notes', notes.trim());
  const response = await apiClient.post<{ tax_document: TaxDocumentSummary }>('/profile/tax-document', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.tax_document;
};

export const downloadTaxDocument = async (name: string): Promise<void> => {
  const response = await apiClient.get<Blob>('/profile/tax-document/download', { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to begin consuming the local blob, then discard it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const validateTaxDocument = (document: File | null): string | null => {
  if (!document) return 'Choose a document to upload.';
  if (!/\.(pdf|png|jpe?g)$/i.test(document.name)) return 'Choose a PDF, PNG or JPG document.';
  if (document.size > 10 * 1024 * 1024) return 'Choose a document no larger than 10 MB.';
  if (document.size === 0) return 'Choose a document that is not empty.';
  return null;
};
