import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VoiceLinePolicyEditor from './VoiceLinePolicyEditor';
import { updateVoiceNumber } from '@/services/voice';
import type { VoiceNumberConfig } from '@/types/voice';

vi.mock('@/services/voice', () => ({ updateVoiceNumber: vi.fn(), uploadVoiceGreeting: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('./PrivateVoiceAudio', () => ({ default: () => null }));
const number = { id: 4, phone_number: '+12027803332', line_policy: { mode: 'staff_voicemail', recipient_role: 'editing_manager', recipient_roles: ['editing_manager'], recipient_ids: [377], timezone: 'Asia/Kolkata', weekly_hours: {} } } as VoiceNumberConfig;
function show(canManage = true) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><VoiceLinePolicyEditor number={number} staff={[{ id: 377, name: 'Editing Manager', role: 'editing_manager' }]} canManage={canManage} /></QueryClientProvider>);
}
describe('Voice line text-only settings', () => {
  beforeEach(() => vi.clearAllMocks());
  it('retains editable staff assignments when switching between text only and calls', async () => {
    vi.mocked(updateVoiceNumber).mockResolvedValue(number);
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Configure routing' }));
    fireEvent.change(screen.getByLabelText('Routing'), { target: { value: 'sms_only' } });
    expect((screen.getByLabelText('Editing Manager') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Editing managers') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText('Weekly opening hours')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save routing' }));
    await waitFor(() => expect(updateVoiceNumber).toHaveBeenCalledWith(4, { line_policy: expect.objectContaining({ mode: 'sms_only', recipient_ids: [377], recipient_roles: ['editing_manager'] }) }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save routing' }).hasAttribute('disabled')).toBe(false));
    fireEvent.change(screen.getByLabelText('Routing'), { target: { value: 'staff_voicemail' } });
    expect((screen.getByLabelText('Editing Manager') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Weekly opening hours')).toBeTruthy();
  });
  it('keeps routing controls restricted to line managers', () => {
    show(false);
    expect(screen.queryByRole('button', { name: 'Configure routing' })).toBeNull();
  });
});
