import { useRef, useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useRobbieGuides } from './useRobbieGuides';

const question = 'Help me with: Upload shoot photos';
const context = { intent: 'support_faq', source: 'knowledge_base', knowledge_article_id: 'upload-photos' };
function mount(initialDraft = '', url = '/chat-with-reproai') {
  return renderHook(() => {
    const [message, setMessage] = useState(initialDraft);
    const [sessionId, setSessionId] = useState<string | null>('existing-chat');
    const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
    return { message, setMessage, setSessionId, location: useLocation(), navigate: useNavigate(), ...useRobbieGuides({ sessionId, setMessage, messageInputRef }) };
  }, { wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter> });
}

describe('Robbie guides within a conversation', () => {
  it('opens legacy deep links and keeps unrelated route context on close', () => {
    const { result } = mount('My existing draft', '/chat-with-reproai?tab=help&article=upload-photos&from=calls');
    expect(result.current.guidesOpen).toBe(true);
    act(() => result.current.setGuidesOpen(false));
    expect(result.current.location.search).toBe('?from=calls');
    expect(result.current.message).toBe('My existing draft');
    act(() => result.current.navigate(-1));
    expect(result.current.guidesOpen).toBe(true);
    act(() => result.current.navigate(1));
    expect(result.current.guidesOpen).toBe(false);
  });

  it('appends to an authored draft without changing it or duplicating a selected guide', () => {
    const draft = 'Please help with the second file.  ';
    const { result } = mount(draft, '/chat-with-reproai?article=upload-photos');
    act(() => result.current.prepareGuideQuestion(question, context));
    expect(result.current.message).toBe(`${draft}\n\n${question}`);
    expect(result.current.guidesOpen).toBe(false);
    expect(result.current.getGuideContext(result.current.message)).toEqual(context);
    act(() => result.current.prepareGuideQuestion(question, context));
    expect(result.current.message).toBe(`${draft}\n\n${question}`);
  });

  it('does not attach a removed guide question or another conversation’s context', () => {
    const { result } = mount();
    act(() => result.current.prepareGuideQuestion(question, context));
    expect(result.current.getGuideContext('Book a new shoot')).toBeUndefined();
    act(() => result.current.setSessionId('another-chat'));
    expect(result.current.getGuideContext(result.current.message)).toBeUndefined();
  });

  it('consumes guide context when explicitly sending without affecting future drafts', () => {
    const { result } = mount();
    act(() => result.current.prepareGuideQuestion(question, context));
    expect(result.current.message).toBe(question);
    expect(result.current.getGuideContext(question)).toEqual(context);
    act(() => result.current.clearGuideContext());
    expect(result.current.getGuideContext(question)).toBeUndefined();
  });
});
