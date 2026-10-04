import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShootPropertyAccessFields } from './ShootPropertyAccessFields';
import type { PropertyDetails } from './shootEditModalTypes';

afterEach(cleanup);
describe('edit shoot property access', () => {
  it('switches fields and preserves typed values while switching methods', () => {
    function Form() {
      const [details, setDetails] = useState<PropertyDetails>({ presenceOption: 'lockbox', lockboxCode: '1234', aptSuite: '5' });
      return <><ShootPropertyAccessFields details={details} onChange={(patch) => setDetails((prev) => ({ ...prev, ...patch }))} /><output>{JSON.stringify(details)}</output></>;
    }
    render(<Form />);
    expect(screen.getByLabelText('Lockbox code')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Another contact' }));
    expect(screen.queryByLabelText('Lockbox code')).toBeNull();
    fireEvent.change(screen.getByLabelText('On-site contact name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('On-site contact phone'), { target: { value: '555-0100' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Self / client' }));
    expect(screen.queryByLabelText('On-site contact name')).toBeNull();
    expect(screen.queryByLabelText('Lockbox code')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Lockbox' }));
    expect((screen.getByLabelText('Lockbox code') as HTMLInputElement).value).toBe('1234');
    fireEvent.click(screen.getByRole('radio', { name: 'Another contact' }));
    expect((screen.getByLabelText('On-site contact name') as HTMLInputElement).value).toBe('Alex');
    expect(JSON.parse(screen.getByRole('status').textContent || '{}')).toMatchObject({ presenceOption: 'other', accessContactName: 'Alex', accessContactPhone: '555-0100', aptSuite: '5' });
  });
});
