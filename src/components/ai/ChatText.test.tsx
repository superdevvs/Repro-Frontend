import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChatText } from './ChatText';

describe('Robbie support links', () => {
  it('opens a real support form from an answer and retains formatting', () => {
    render(<MemoryRouter><Routes><Route path="/" element={<p><ChatText content={'**Need help?** [Create a support request](/support?new=1) or call [Support](tel:+12028681663). Keep `SUP-000001`.'} /></p>} /><Route path="/support" element={<h1>Support form</h1>} /></Routes></MemoryRouter>);
    expect(screen.getByText('Need help?').tagName).toBe('STRONG');
    expect(screen.getByText('SUP-000001').tagName).toBe('CODE');
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'tel:+12028681663');
    fireEvent.click(screen.getByRole('link', { name: 'Create a support request' }));
    expect(screen.getByRole('heading', { name: 'Support form' })).toBeInTheDocument();
  });

  it('leaves unsafe targets and HTML inert', () => {
    const { container } = render(<MemoryRouter><ChatText content={'[Bad](javascript:alert(1)) [Foreign](//example.test) [Escaped](/\\example.test) <img src=x onerror=alert(1) />'} /></MemoryRouter>);
    expect(container.querySelectorAll('a, img, script')).toHaveLength(0);
    expect(container.textContent).toContain('<img src=x');
  });
});
