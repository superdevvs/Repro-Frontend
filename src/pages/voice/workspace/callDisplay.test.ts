import { describe, expect, it } from 'vitest';
import type { VoiceCall } from '@/types/voice';
import {
  availabilityLabel,
  callerName,
  callDirectionLabel,
  getCallPhone,
  formatDelta,
  inboxFilterFor,
  inboxStatusLine,
  isLiveCall,
  needsReview,
  recordingMoments,
  smsSegmentCount,
  suggestedSms,
  toolLabel,
} from './callDisplay';

const call = (overrides: Partial<VoiceCall> = {}): VoiceCall => ({
  id: 12,
  direction: 'INBOUND',
  status: 'completed',
  from_phone: '+12025550124',
  caller_contact: { name: 'Alex Morgan' },
  needs_follow_up: true,
  related_shoot: { id: 8, address: '124 Cedar Lane', status: 'scheduled' },
  summary: 'The gate code no longer works.',
  ...overrides,
});

describe('callDisplay', () => {
  it('recognizes active AI work and never treats an ended call as live', () => {
    expect(isLiveCall(call({ status: 'ai_active' }))).toBe(true);
    expect(isLiveCall(call({ status: 'tool_running' }))).toBe(true);
    expect(isLiveCall(call({ status: 'active', ended_at: '2026-09-21T12:00:00Z' }))).toBe(false);
  });
  it('names the caller from contact, then phone', () => {
    expect(callerName(call())).toBe('Alex Morgan');
    expect(callerName(call({ caller_contact: null, from_phone: '+12025550100' }))).toBe('+12025550100');
  });

  it('flags follow-up conversations as needing review', () => {
    expect(needsReview(call())).toBe(true);
    expect(needsReview(call({ needs_follow_up: false, disposition: 'completed' }))).toBe(false);
  });

  it('describes inbox status from live, voicemail, or follow-up state', () => {
    expect(inboxStatusLine(call({ status: 'in_progress', duration_seconds: 154 }))).toContain('Live');
    expect(inboxStatusLine(call({ disposition: 'voicemail' }))).toContain('Voicemail');
    expect(inboxStatusLine(call())).toContain('Needs attention');
  });

  it('keeps the all-calls filter off the API and drafts an SMS from the recap', () => {
    expect(inboxFilterFor('all')).toBeUndefined();
    expect(inboxFilterFor('needs_attention')).toBe('needs_attention');
    expect(suggestedSms(call())).toMatch(/Hi Alex/);
  });

  it('uses real availability and hides empty deltas', () => {
    expect(availabilityLabel(2, true)).toBe('2 live');
    expect(availabilityLabel(0, false)).toBe('Outbound not ready');
    expect(availabilityLabel(0, false, 'none')).toBe('Outbound off');
    expect(formatDelta(null)).toBeNull();
    expect(formatDelta(6.2)).toBe('+6.2');
  });

  it('turns snake_case voice tools into readable labels', () => {
    expect(toolLabel('verify_caller')).toBe('Verify caller');
    expect(toolLabel('get_shoot_details')).toBe('Get shoot details');
    expect(toolLabel('set_recording_consent')).toBe('Set recording consent');
  });

  it('targets the remote party and never falls back to the business line', () => {
    expect(getCallPhone(call({ direction: 'OUTBOUND', from_phone: '+12025550000', to_phone: '+12025550124' }))).toBe('+12025550124');
    expect(getCallPhone(call({ direction: 'OUTBOUND', from_phone: '+12025550000', to_phone: null }))).toBe('');
    expect(getCallPhone(call({ direction: 'INBOUND', from_phone: null, to_phone: '+12025550000' }))).toBe('');
  });

  it('only marks an inbound call missed when it ended without an answer', () => {
    expect(callDirectionLabel(call({ ended_at: '2026-09-20T14:00:00Z', answered_at: '2026-09-20T13:58:00Z' }))).toBe('Incoming');
    expect(callDirectionLabel(call({ ended_at: '2026-09-20T14:00:00Z' }))).toBe('Missed incoming');
  });

  it('does not invent replay timestamps from untimed call intelligence', () => {
    expect(recordingMoments(call({ duration_seconds: 252, intent: 'booking', escalation_reason: 'gate issue', metadata: { intel_final: { next_best_action: 'Call back' } } }))).toEqual([]);
    expect(recordingMoments(call({ duration_seconds: 60, metadata: { recording_moments: [{ seconds: 12, label: 'Gate code' }, { seconds: 90, label: 'Invalid' }] } }))).toEqual([{ seconds: 12, at: '0:12', label: 'Gate code' }]);
  });

  it('counts GSM extension and Unicode multipart SMS lengths', () => {
    expect(smsSegmentCount('A'.repeat(160))).toBe(1);
    expect(smsSegmentCount('^'.repeat(81))).toBe(2);
    expect(smsSegmentCount('—'.repeat(71))).toBe(2);
  });
});
