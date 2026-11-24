import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { IguideFloorplanControls } from './IguideFloorplanControls';
import { uploadMediaRequest } from './uploadMediaRequest';

vi.mock('./uploadMediaRequest', () => ({ uploadMediaRequest: vi.fn() }));

it('sends manual floor plans to the selected iGuide service and shows the separate tour release state', async () => {
  vi.mocked(uploadMediaRequest).mockResolvedValue({
    ok: true, status: 200, responseText: JSON.stringify({ success_count: 1 }),
  });
  const onShootUpdate = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IguideFloorplanControls shootId={5980} onShootUpdate={onShootUpdate} operations={{
        linked: true, providerLinkSaved: true, imported: 4, expected: 4,
        targets: [
          { id: '6186', name: 'Apt 5', tourStatus: 'ready', manualCount: 0 },
          { id: '6187', name: 'Apt 6', tourStatus: 'pending', manualCount: 0 },
        ],
      }} />
    </QueryClientProvider>,
  );
  expect(screen.getByText('Synced')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Add floor plans' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('combobox', { name: 'Floor plan service' }), { target: { value: '6186' } });
  expect(screen.getByText('Ready to release')).toBeTruthy();
  const file = new File(['floor plan'], 'floorplan.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Floor plan files'), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('1 floor plan file accepted'));
  const request = vi.mocked(uploadMediaRequest).mock.calls[0][0];
  expect(request.url).toContain('/api/shoots/5980/upload');
  expect(request.body.get('shoot_service_id')).toBe('6186');
  expect(request.body.get('media_type')).toBe('floorplan');
  expect(request.body.get('files[]')).toMatchObject({ name: file.name, type: file.type });
  expect(onShootUpdate).toHaveBeenCalledOnce();
});
