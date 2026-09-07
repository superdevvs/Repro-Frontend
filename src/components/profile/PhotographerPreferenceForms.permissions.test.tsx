import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PhotographerSpecialtiesForm } from './PhotographerPreferenceForms';

const mocks = vi.hoisted(() => ({ saveProfile: vi.fn(), categories: [{ id: 1, name: 'Photography' }], services: [], user: { role: 'photographer', metadata: { specialties: ['category:1'], property_types: ['Single Family'] } } }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useSelfProfileSave', () => ({ useSelfProfileSave: () => ({ saveProfile: mocks.saveProfile }) }));
vi.mock('@/hooks/useServiceCategories', () => ({ useServiceCategories: () => ({ data: mocks.categories }) }));
vi.mock('@/hooks/useServices', () => ({ useServices: () => ({ data: mocks.services }) }));

describe('photographer capability permissions', () => {
  afterEach(cleanup);
  it('shows assigned specialties and property experience without self-edit controls', () => {
    render(<PhotographerSpecialtiesForm />);
    expect(screen.getByText('Photography')).toBeInTheDocument();
    expect(screen.getByText('Single Family')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save specialties/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/managed by your admin/i)).toHaveLength(2);
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
});
