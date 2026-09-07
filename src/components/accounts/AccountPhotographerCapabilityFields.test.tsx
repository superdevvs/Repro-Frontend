import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import type { AccountFormValues } from './accountFormModel';
import { AccountPhotographerCapabilityFields } from './AccountPhotographerCapabilityFields';
import { applyPhotographerAccountPayload } from './photographerAccountPayload';
import { canManagePhotographerCapabilities } from '@/utils/photographerCapabilities';

function AccountForm({ canManage, onSave }: { canManage: boolean; onSave: (value: unknown) => void }) {
  const form = useForm<AccountFormValues>({ defaultValues: { specialties: ['category:1'], propertyTypes: ['Office'] } });
  return <Form {...form}><form onSubmit={form.handleSubmit((values) => {
    const metadata = { specialties: ['category:old'], property_types: ['Single Family'], insuranceNumber: 'POLICY-1' };
    const payload = { ...values };
    applyPhotographerAccountPayload(values, metadata, payload, canManage);
    onSave({ metadata, payload });
  })}>
    <AccountPhotographerCapabilityFields control={form.control} categories={[{ id: 'category:1', label: 'Photography', services: [{ id: 'service:1' }] }]} isLoading={false} canManage={canManage} />
    <button type="submit">Save account</button>
  </form></Form>;
}

describe('admin capability management', () => {
  afterEach(cleanup);
  it.each(['admin', 'superadmin'])('lets %s clear both assignments and persists empty arrays', async (role) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AccountForm canManage={canManagePhotographerCapabilities(role)} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Photography' }));
    await user.click(screen.getByRole('checkbox', { name: 'Office' }));
    await user.click(screen.getByRole('button', { name: 'Save account' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ metadata: {
      specialties: [], property_types: [], insuranceNumber: 'POLICY-1',
    } })));
  });

  it.each([
    ['photographer', false], ['editing_manager', false], ['admin', true],
  ])('keeps capabilities read-only for effective %s (impersonating=%s) and omits them from other account edits', async (role, impersonating) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AccountForm canManage={canManagePhotographerCapabilities(role, impersonating)} onSave={onSave} />);
    expect(screen.getByRole('button', { name: 'Photography' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Office' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Save account' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ metadata: { insuranceNumber: 'POLICY-1' }, payload: {} }));
  });
});
