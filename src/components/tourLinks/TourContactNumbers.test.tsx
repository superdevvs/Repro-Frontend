import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourContactNumbers } from './TourContactNumbers';
import { formatTourPhoneNumber } from './tourDisplayUtils';

afterEach(cleanup);

describe('public tour contact numbers', () => {
  it.each([
    ['3019607194', '(301) 960-7194'],
    ['8333357433', '(833) 335-7433'],
    ['301-960-7194', '(301) 960-7194'],
    ['13019607194', '+1 (301) 960-7194'],
    ['+1 (301) 960-7194', '+1 (301) 960-7194'],
    ['+44 20 7946 0958', '+44 20 7946 0958'],
    ['(301) 960-7194 ext. 42', '(301) 960-7194 ext. 42'],
  ])('formats %s without changing its number', (raw, display) => {
    expect(formatTourPhoneNumber(raw)).toBe(display);
  });

  it('shows Harry’s two formatted numbers in one row with icons and a separator', () => {
    const onPhoneClick = vi.fn();
    const { container } = render(<TourContactNumbers source={{ client_phone: '3019607194', office_phone: '8333357433' }} onPhoneClick={onPhoneClick} />);
    const group = screen.getByRole('group', { name: 'Contact phone numbers' });
    const personal = screen.getByRole('link', { name: '(301) 960-7194' });
    const office = screen.getByRole('link', { name: 'Office (833) 335-7433' });
    expect(personal).toHaveAttribute('href', 'tel:3019607194');
    expect(office).toHaveAttribute('href', 'tel:8333357433');
    expect(group).toHaveTextContent('(301) 960-7194|(833) 335-7433');
    expect(container.querySelectorAll('a > svg')).toHaveLength(2);
    office.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(office);
    expect(onPhoneClick).toHaveBeenCalledWith('8333357433');
  });

  it('respects the office visibility setting and omits an orphan separator', () => {
    render(<TourContactNumbers source={{ client_phone: '3019607194', office_phone: '8333357433', show_office_phone_on_tour: false }} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('|')).not.toBeInTheDocument();
    expect(screen.queryByText('(833) 335-7433')).not.toBeInTheDocument();
  });

  it('supports office-only contact and omits an empty contact row', () => {
    const { rerender } = render(<TourContactNumbers source={{ office_phone: '8333357433' }} />);
    expect(screen.getByRole('link', { name: 'Office (833) 335-7433' })).toHaveAttribute('href', 'tel:8333357433');
    expect(screen.queryByText('|')).not.toBeInTheDocument();
    rerender(<TourContactNumbers source={{}} />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
