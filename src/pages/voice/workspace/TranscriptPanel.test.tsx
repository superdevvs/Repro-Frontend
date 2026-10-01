import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TranscriptPanel from './TranscriptPanel';
import type { VoiceCall } from '@/types/voice';

const mocks = vi.hoisted(() => ({ getVoiceTranscript: vi.fn(), reconcileVoiceTranscript: vi.fn(), recoverVoiceTranscript: vi.fn(), can: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/voice', () => mocks);
vi.mock('@/context/PermissionsContext', () => ({ usePermissions: () => ({ can: mocks.can }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
const call = { id:12, direction:'INBOUND', status:'completed', transcript:'Customer: Please help me find Download Center.' } as VoiceCall;
const state = { transcript:call.transcript, state:'partial', last_chunk_at:null, segment_count:1, summary_stale:true, can_rebuild:true, completeness:'provider_unverified', message:'Captured segments may be incomplete.', recording_available:true, source:'live_segments', can_retry_recording:true, recovery:null };
const renderPanel = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions:{queries:{retry:false},mutations:{retry:false}} })}><TranscriptPanel call={call} /></QueryClientProvider>);
describe('Transcript lifecycle and recovery',()=>{
  beforeEach(()=>{ mocks.can.mockReturnValue(true); mocks.getVoiceTranscript.mockResolvedValue(state); });
  afterEach(()=>{ cleanup();vi.clearAllMocks(); });
  it('labels partial capture honestly and searches saved text',async()=>{
    renderPanel();
    expect(await screen.findByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Captured segments may be incomplete.')).toBeInTheDocument();
    expect(screen.getByText(/recap may not include/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search saved transcript'),'unmatched');
    expect(screen.getByText('No matching transcript text.')).toBeInTheDocument();
  });
  it('reuses a recovery request key after an uncertain request and polls the queued job',async()=>{
    mocks.recoverVoiceTranscript.mockRejectedValueOnce(new Error('Network response lost')).mockResolvedValueOnce({...state,can_retry_recording:false,recovery:{id:7,status:'queued',attempt:1,error:null,source:'customer_recording'}});
    renderPanel();
    await userEvent.click(await screen.findByRole('button',{name:'Recover from recording'}));
    await waitFor(()=>expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({title:'Could not request recovery'})));
    await userEvent.click(screen.getByRole('button',{name:'Recover from recording'}));
    await waitFor(()=>expect(mocks.recoverVoiceTranscript).toHaveBeenCalledTimes(2));
    expect(mocks.recoverVoiceTranscript.mock.calls[0]).toEqual(mocks.recoverVoiceTranscript.mock.calls[1]);
    expect(await screen.findByText(/Recording recovery: queued/)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Recover from recording'})).not.toBeInTheDocument();
  });
  it('keeps recording recovery provenance and denies mutations to a viewer',async()=>{
    mocks.can.mockReturnValue(false); mocks.getVoiceTranscript.mockResolvedValue({...state,source:'recording_recovery',state:'ready',recovery:{id:7,status:'succeeded',attempt:1,error:null,source:'customer_recording'}});
    renderPanel();
    expect(await screen.findByText(/Speaker identities were not inferred/)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Recover from recording'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Refresh saved transcript'})).not.toBeInTheDocument();
    expect(mocks.recoverVoiceTranscript).not.toHaveBeenCalled();
  });
  it('renders, searches and copies the server presentation while preserving customer markup',async()=>{
    const user = userEvent.setup();
    const display = 'assistant: Open Download Center.\ncustomer: I see <break time="0.3s" /> in the instructions.';
    mocks.getVoiceTranscript.mockResolvedValue({...state, transcript:'assistant: Open <break time="0.3s" /> Download Center.\ncustomer: I see <break time="0.3s" /> in the instructions.', display_transcript:display});
    const clipboard = vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue();
    renderPanel();
    expect(await screen.findByText('assistant: Open Download Center.')).toBeInTheDocument();
    expect(screen.getByText('customer: I see <break time="0.3s" /> in the instructions.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search saved transcript'),'Open Download');
    expect(screen.getByText('assistant: Open Download Center.')).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Copy'}));
    expect(clipboard).toHaveBeenCalledWith(display);
    clipboard.mockRestore();
  });
});
