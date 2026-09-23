import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_FORM } from './emailComposeModel';
import { EmailComposeView } from './EmailComposeView';

vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => true }));
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('mobile email compose', () => {
  it('keeps send in the header and the message on the page', () => {
    render(
      <EmailComposeView
        currentMode={{ title: 'Compose Email', subtitle: 'unused', sendLabel: 'Send Email' }}
        lastSaved={null}
        draftAttachments={[]}
        navigate={vi.fn()}
        canSendExternal
        setPreviewMode={vi.fn()}
        previewMode={false}
        setShowScheduleDialog={vi.fn()}
        resetCompose={vi.fn()}
        handleSendNow={vi.fn()}
        sendMutation={{ isPending: false }}
        scheduleMutation={{ isPending: false }}
        isMissingRequiredShootContext={false}
        isInternalReply={false}
        setPriority={vi.fn()}
        priority="normal"
        showCcBcc={false}
        recipients={{ to: [], cc: [], bcc: [] }}
        setShowCcBcc={vi.fn()}
        renderRecipientField={() => <input aria-label="To" />}
        form={EMPTY_FORM}
        setFormValue={vi.fn()}
        setTemplateCustomized={vi.fn()}
        templates={[]}
        setForm={vi.fn()}
        applyTemplate={vi.fn()}
        isLoadingContactShoots={false}
        contactShootOptions={[]}
        channels={[]}
        previewSubject=""
        previewBodyHtml=""
        fileInputRef={{ current: null }}
        attachFiles={vi.fn()}
        attachments={[]}
        setAttachments={vi.fn()}
        setDraftAttachments={vi.fn()}
        templateSuggestions={[]}
        messageInfo={{ recipients: 0, words: 0, characters: 0, attachments: 0 }}
        showScheduleDialog={false}
        handleSchedule={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Send Email' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to inbox' })).toBeInTheDocument();
    expect(screen.queryByText('Send summary')).not.toBeInTheDocument();
  });
});
