import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ShootData } from '@/types/shoots';
import { ShootUnitScopeBar } from './ShootUnitScope';

afterEach(cleanup);
describe('shared unit selector', () => {
  it('bounds 100 units and does not open the surrounding shoot card while switching', () => {
    const onCardClick = vi.fn();
    const shoot = { id: 'scope-click-test', units: Array.from({ length: 100 }, (_, index) => ({ id: index + 1, label: `Unit ${String(index + 1).padStart(3, '0')}`, kind: 'unit', sqft: 900, beds: 1, baths: 1 })) } as ShootData;
    render(<div onClick={onCardClick}><ShootUnitScopeBar shoot={shoot} /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(screen.getByText('Unit 002 · 900 sqft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change unit' }));
    expect(document.querySelectorAll('button[aria-pressed]').length).toBe(8);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search units' }), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Unit 100/ }));
    expect(screen.getByText('Unit 100 · 900 sqft')).toBeInTheDocument();
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
