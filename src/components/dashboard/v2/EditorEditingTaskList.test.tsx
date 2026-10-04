import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EditorEditingTaskList } from './EditorEditingTaskList';

vi.mock('@/components/shoots/EditingTasks', () => ({ EditingTasks: ({ shootId }: { shootId: number }) => <div role="dialog">Tasks for shoot {shootId}</div> }));
const task = (id: string, shoot_id: number, count: number) => ({ id, shoot_id, address: `Property ${shoot_id}`, scope: 'whole', status: 'assigned', pending_items_count: count });

it('shows new assignments in the queue, groups requests by shoot and opens only that shoot', () => {
  render(<EditorEditingTaskList tasks={[task('a', 379, 35), task('b', 670, 26), task('c', 379, 2)]} isLoading={false} isError={false} onRefresh={vi.fn()} />);
  expect(screen.getByText('Shoot #379 · 37 media tasks · 2 requests')).toBeVisible();
  expect(screen.getByText('Shoot #670 · 26 media tasks · 1 request')).toBeVisible();
  expect(screen.getAllByRole('button', { name: /Open editing tasks for/ })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Open editing tasks for Property 670' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Tasks for shoot 670');
});

it('exposes a failed fetch and a retry instead of hiding work behind an empty state', () => {
  const refresh = vi.fn();
  render(<EditorEditingTaskList tasks={[]} isLoading={false} isError onRefresh={refresh} />);
  expect(screen.getByRole('alert')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(refresh).toHaveBeenCalledOnce();
});
