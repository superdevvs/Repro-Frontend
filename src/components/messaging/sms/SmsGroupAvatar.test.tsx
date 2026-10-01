import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SmsThreadAvatar, smsPersonInitials } from './SmsGroupAvatar';

describe('SmsThreadAvatar', () => {
  it('builds initials from names and phones', () => {
    expect(smsPersonInitials({ name: 'Sam Keller' })).toBe('SK');
    expect(smsPersonInitials({ name: 'Pat' })).toBe('PA');
    expect(smsPersonInitials({ phone: '+17035551212' })).toBe('12');
  });

  it('renders a single avatar for direct threads', () => {
    const { container } = render(
      <SmsThreadAvatar mode="direct" person={{ name: 'Jordan Lee', phone: '555' }} />,
    );
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.textContent).toContain('JL');
  });

  it('renders a 2×2 composite grid for group threads', () => {
    const { container, getByRole } = render(
      <SmsThreadAvatar
        mode="group"
        memberCount={3}
        people={[
          { id: 1, name: 'Ada Lovelace' },
          { id: 2, name: 'Grace Hopper' },
        ]}
      />,
    );
    expect(getByRole('img', { name: 'Group avatar' })).toBeTruthy();
    const cells = container.querySelectorAll('[aria-hidden]');
    expect(cells.length).toBe(4);
  });
});
