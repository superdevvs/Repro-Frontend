import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/config/env';
import { getStoredAuthToken } from '@/utils/authToken';
import type { ScheduleState, VoiceInsights } from '@/types/voice';

export interface TranscriptChunk {
  seq: number;
  text: string;
  speaker: string;
  ts: string;
  telnyx_confidence?: number | null;
  sentiment?: string | null;
}

export interface RealtimeSignals {
  confidence?: number | null;
  sentiment?: string | null;
  interruption_rate?: number;
  silence_sec?: number;
  speaking_pace_wpm?: number;
  last_keyword_hit?: string | null;
}

export interface MemorySnapshot {
  tier1?: Record<string, unknown> | null;
  tier2?: Record<string, unknown> | null;
  tier3?: Record<string, unknown> | null;
}

export interface CallLiveState {
  connected: boolean;
  closed: boolean;
  transcript: TranscriptChunk[];
  realtime: RealtimeSignals;
  insights: VoiceInsights | null;
  finalSummary: VoiceInsights | null;
  memory: MemorySnapshot;
  scheduleState: ScheduleState | null;
}

const initialState: CallLiveState = {
  connected: false,
  closed: false,
  transcript: [],
  realtime: {},
  insights: null,
  finalSummary: null,
  memory: {},
  scheduleState: null,
};

/**
 * Subscribes to the voice call SSE stream using fetch streaming so we can send
 * the Bearer token (EventSource cannot set headers). Auto-reconnects until the
 * call is closed.
 */
export function useCallLiveStream(callId: number | null, callerTz?: string): CallLiveState {
  const [state, setState] = useState<CallLiveState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!callId) {
      return;
    }

    setState({ ...initialState });
    let cancelled = false;
    let retryTimer: number | undefined;

    const connect = async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const token = getStoredAuthToken();
      const params = new URLSearchParams();
      if (callerTz) params.set('caller_tz', callerTz);
      const qs = params.toString();
      const url = `${API_BASE_URL}/api/voice/calls/${callId}/stream${qs ? `?${qs}` : ''}`;

      try {
        const response = await fetch(url, {
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`stream failed: ${response.status}`);
        }

        setState((prev) => ({ ...prev, connected: true }));

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            handleFrame(frame);
          }
        }
      } catch (err) {
        if (cancelled) return;
        // schedule a reconnect unless we are closed
        setState((prev) => {
          if (prev.closed) return prev;
          retryTimer = window.setTimeout(connect, 2000);
          return { ...prev, connected: false };
        });
      }
    };

    const handleFrame = (frame: string) => {
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        // lines starting with ':' are comments/heartbeats — ignore
      }
      if (dataLines.length === 0) return;
      let payload: unknown;
      try {
        payload = JSON.parse(dataLines.join('\n'));
      } catch {
        return;
      }
      applyEvent(event, payload);
    };

    const applyEvent = (event: string, payload: any) => {
      setState((prev) => {
        switch (event) {
          case 'transcript':
            return { ...prev, transcript: payload.chunks ?? prev.transcript };
          case 'realtime':
            return { ...prev, realtime: payload ?? prev.realtime };
          case 'insights':
            return { ...prev, insights: payload ?? prev.insights };
          case 'memory':
            return { ...prev, memory: payload ?? prev.memory };
          case 'schedule_state':
            return { ...prev, scheduleState: payload ?? prev.scheduleState };
          case 'final_summary':
            return { ...prev, finalSummary: payload ?? prev.finalSummary };
          case 'closed':
            return { ...prev, closed: true, connected: false };
          default:
            return prev;
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      abortRef.current?.abort();
    };
  }, [callId, callerTz]);

  return state;
}
